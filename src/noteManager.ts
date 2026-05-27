/**
 * Note Manager - handles reading/writing tracking data to Joplin notes.
 */

import joplin from 'api';
import {
  TimeSession,
  WeeklyBreakdown,
  minutesToHHMM,
  getDayOfWeek,
  getKWLabel,
  parseDate,
} from './timeUtils';
import {
  extractFrontmatter,
  updateFrontmatter,
  buildFrontmatterUpdates,
  FrontmatterData,
} from './frontmatter';

export interface NoteInfo {
  id: string;
  title: string;
  body: string;
}

export class NoteManager {

  /**
   * Find all notes tagged with the given tag title.
   *
   * Strategy:
   *   1. Search for the tag object by title, then fetch notes via /tags/:id/notes
   *   2. FTS query with tag: filter on notes
   *   3. Walk all notes, filter by tag client-side (last resort)
   */
  static async findNotesByTag(tagTitle: string): Promise<NoteInfo[]> {
    console.log('[TimeTracker] findNotesByTag: searching for "' + tagTitle + '"');

    // ── Strategy 1: find tag object, then its notes (Time Slip pattern) ──
    try {
      // SEARCH endpoint uses fields as STRING
      const tagResult = await joplin.data.get(['search'], {
        query: tagTitle,
        fields: 'id,title',
        type: 'tag',
      });
      const tags = tagResult?.items || [];
      console.log('[TimeTracker] Tag search returned ' + tags.length + ' tag(s)');

      if (tags.length > 0) {
        const allNotes: NoteInfo[] = [];
        for (const tag of tags) {
          let page = 1;
          let hasMore = true;
          while (hasMore) {
            // /tags/:id/notes uses fields as ARRAY
            const notesResult = await joplin.data.get(
              ['tags', tag.id, 'notes'],
              { fields: ['id', 'title', 'body'], page: page }
            );
            if (notesResult?.items) {
              for (const n of notesResult.items) {
                if (!allNotes.find((x) => x.id === n.id)) {
                  allNotes.push(n as NoteInfo);
                }
              }
            }
            hasMore = notesResult?.has_more || false;
            page++;
          }
        }
        if (allNotes.length > 0) {
          console.log('[TimeTracker] Found ' + allNotes.length + ' note(s) via tag->notes');
          return allNotes;
        }
      }
    } catch (e: any) {
      console.warn('[TimeTracker] Strategy 1 (tag search) failed:', e.message || e);
    }

    // ── Strategy 2: FTS query with tag: filter ──
    try {
      // SEARCH endpoint uses fields as STRING
      const r2 = await joplin.data.get(['search'], {
        query: 'tag:' + tagTitle,
        fields: 'id,title,body',
        type: 'note',
      });
      if (r2 && r2.items && r2.items.length > 0) {
        console.log('[TimeTracker] Found ' + r2.items.length + ' note(s) via FTS tag: query');
        return r2.items as NoteInfo[];
      }
    } catch (e: any) {
      console.warn('[TimeTracker] Strategy 2 (FTS tag:) failed:', e.message || e);
    }

    // ── Strategy 3: walk all notes, check tags individually ──
    try {
      console.log('[TimeTracker] Falling back to full note scan...');
      // /notes uses fields as ARRAY
      const allResult = await joplin.data.get(['notes'], {
        fields: ['id', 'title', 'body'],
        order_by: 'title',
      });
      if (allResult?.items) {
        console.log('[TimeTracker] Scanning ' + allResult.items.length + ' notes for tag match...');
        const tagged: NoteInfo[] = [];
        for (const note of allResult.items) {
          try {
            // /notes/:id/tags uses fields as ARRAY
            const noteTags = await joplin.data.get(['notes', note.id, 'tags'], {
              fields: ['id', 'title'],
            });
            if (noteTags?.items) {
              for (const t of noteTags.items) {
                if (t.title && t.title.toLowerCase() === tagTitle.toLowerCase()) {
                  tagged.push(note as NoteInfo);
                  break;
                }
              }
            }
          } catch (_) { /* skip */ }
        }
        console.log('[TimeTracker] Full scan found ' + tagged.length + ' note(s)');
        return tagged;
      }
    } catch (e: any) {
      console.warn('[TimeTracker] Strategy 3 (full scan) failed:', e.message || e);
    }

    console.log('[TimeTracker] No notes found with tag "' + tagTitle + '"');
    return [];
  }

  static async getNote(noteId: string): Promise<NoteInfo | null> {
    try {
      // /notes/:id uses fields as ARRAY
      const note = await joplin.data.get(['notes', noteId], {
        fields: ['id', 'title', 'body'],
      });
      return note as NoteInfo;
    } catch (e) {
      console.error('TimeTracker: Error getting note:', e);
      return null;
    }
  }

  static async updateNoteBody(noteId: string, body: string): Promise<void> {
    await joplin.data.put(['notes', noteId], null, { body });
  }

  static parseSessionsFromBody(noteBody: string): TimeSession[] {
    const sessions: TimeSession[] = [];
    if (!noteBody) return sessions;

    const lines = noteBody.split('\n');
    let inTable = false;

    const tableRowRegex = /^\|\s*(\d{2}\.\d{2}\.\d{2})\s*\|\s*(\d{2}:\d{2})\s*(?:\([^)]*\))?\s*\|\s*(\d{2}:\d{2})\s*\|\s*(\d+)\s*\|\s*(\d{2}:\d{2})\s*\|\s*(.*?)\s*\|/;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.includes('**WEEKLY Breakdown**') || trimmed.includes('**Weekly Breakdown**')) {
        continue;
      }

      if (trimmed.startsWith('| Day') || trimmed.startsWith('| --------') || trimmed.startsWith('| --')) {
        inTable = true;
        continue;
      }

      if (!inTable) continue;
      if (!trimmed.startsWith('|')) continue;

      const match = trimmed.match(tableRowRegex);
      if (match) {
        const date = match[1];
        const start = match[2];
        const end = match[3];
        const durationMin = parseInt(match[4], 10) || 0;
        const phase = (match[6] || '').trim();

        const dateObj = parseDate(date);
        const weekday = dateObj ? getDayOfWeek(dateObj) : '';

        sessions.push({ date, weekday, start, end, durationMin, phase });
      }
    }

    return sessions;
  }

  static parseWeeklyBreakdownsFromFrontmatter(data: FrontmatterData): WeeklyBreakdown[] {
    const breakdowns: WeeklyBreakdown[] = [];
    const kwPattern = /^hours_kw(\d{2})$/;

    for (const [key, value] of Object.entries(data)) {
      const match = key.match(kwPattern);
      if (match) {
        const kwNum = match[1];
        const noteKey = 'note_kw' + kwNum;
        let hours = 0;
        if (typeof value === 'string' && value.includes(':')) {
          const [h, m] = value.split(':').map(Number);
          hours = h + (m || 0) / 60;
        } else if (typeof value === 'number') {
          hours = value;
        }
        const now = new Date();
        const currentYear = now.getFullYear();
        const kwLabel = String(currentYear % 100).padStart(2, '0') + ' KW ' + kwNum;
        breakdowns.push({ kwLabel, hours, note: (data[noteKey] as string) || '' });
      }
    }
    return breakdowns;
  }

  static buildMarkdownTable(
    sessions: TimeSession[],
    weeklyBreakdowns: WeeklyBreakdown[],
    totalMinutes: number,
    wordCount: number,
    existingBody: string,
    existingFrontmatter: FrontmatterData,
  ): string {
    const title = existingFrontmatter.title || 'Untitled Project';
    const wcDisplay = wordCount > 0 ? '~' + wordCount : '0';
    const totalHours = totalMinutes / 60;
    const tpt = wordCount > 0
      ? Math.round(((1000 * totalHours) / wordCount) * 10) / 10
      : 0;
    const tptDisplay = tpt.toFixed(1).replace('.', ',');

    const tableRows: string[] = [];
    let currentWeekLabel = '';

    const sortedSessions = [...sessions].sort((a, b) => {
      const dateA = parseDate(a.date);
      const dateB = parseDate(b.date);
      if (!dateA || !dateB) return 0;
      if (dateA.getTime() !== dateB.getTime()) return dateA.getTime() - dateB.getTime();
      return a.start.localeCompare(b.start);
    });

    const sortedBreakdowns = [...weeklyBreakdowns].sort((a, b) => {
      const numA = parseInt(a.kwLabel.match(/KW\s*(\d{2})/i)?.[1] || '0', 10);
      const numB = parseInt(b.kwLabel.match(/KW\s*(\d{2})/i)?.[1] || '0', 10);
      return numA - numB;
    });

    const breakdownMap = new Map<string, WeeklyBreakdown>();
    for (const wb of sortedBreakdowns) breakdownMap.set(wb.kwLabel, wb);

    const processedWeeks = new Set<string>();
    let accumMin = 0;

    for (const session of sortedSessions) {
      const date = parseDate(session.date);
      if (!date) continue;
      const kwLabel = getKWLabel(date);

      if (kwLabel !== currentWeekLabel && currentWeekLabel !== '') {
        const wb = breakdownMap.get(currentWeekLabel);
        if (wb && !processedWeeks.has(currentWeekLabel)) {
          const wh = minutesToHHMM(Math.round(wb.hours * 60));
          tableRows.push('| **WEEKLY Breakdown** <br>**' + currentWeekLabel + '** | | | **' + wh + '** | | ' + (wb.note || '') + ' |');
          processedWeeks.add(currentWeekLabel);
        }
      }
      currentWeekLabel = kwLabel;
      accumMin += session.durationMin;
      tableRows.push(
        '| ' + session.date + ' | ' + session.start + ' (' + session.weekday + ') | ' + session.end +
        ' | ' + session.durationMin + ' | ' + minutesToHHMM(accumMin) + ' | ' + (session.phase || '') + ' |'
      );
    }

    if (currentWeekLabel) {
      const wb = breakdownMap.get(currentWeekLabel);
      if (wb && !processedWeeks.has(currentWeekLabel)) {
        const wh = minutesToHHMM(Math.round(wb.hours * 60));
        tableRows.push('| **WEEKLY Breakdown** <br>**' + currentWeekLabel + '** | | | **' + wh + '** | | ' + (wb.note || '') + ' |');
        processedWeeks.add(currentWeekLabel);
      }
    }

    for (const wb of sortedBreakdowns) {
      if (!processedWeeks.has(wb.kwLabel)) {
        const wh = minutesToHHMM(Math.round(wb.hours * 60));
        tableRows.push('| **WEEKLY Breakdown** <br>**' + wb.kwLabel + '** | | | **' + wh + '** | | ' + (wb.note || '') + ' |');
        processedWeeks.add(wb.kwLabel);
      }
    }

    const tableHeader = '| Day | Start | End | today [min] | Total Chapter [hour:min] (accum.) | Notes/Phase |';
    const tableSeparator = '| -------- | --------------------------- | --- | :---------: | :-------------------------------: | --- |';
    const totalFormatted = minutesToHHMM(totalMinutes);

    return '\n# ' + title + ' (\u007e' + wcDisplay + ')\n\nTpT=  ==~' + tptDisplay + ' h== \u2190 calculated: ((1000*' + totalFormatted + ')/' + (wordCount || '??') + ')\n\n>==' + totalFormatted + '==\n\n' + tableHeader + '\n' + tableSeparator + '\n' + tableRows.join('\n') + '\n| | | | | | |\n| **TOTAL** | | | **' + totalFormatted + '** | | |\n';
  }

  static async recalculateAndUpdate(noteId: string, sessions: TimeSession[], wordCount: number): Promise<void> {
    const note = await NoteManager.getNote(noteId);
    if (!note) return;

    const existing = extractFrontmatter(note.body);
    const frontmatterData = existing?.data || {};
    const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);

    const weekMap = new Map<string, { totalMin: number; notes: string[] }>();
    for (const session of sessions) {
      const date = parseDate(session.date);
      if (!date) continue;
      const kwLabel = getKWLabel(date);
      if (!weekMap.has(kwLabel)) weekMap.set(kwLabel, { totalMin: 0, notes: [] });
      const entry = weekMap.get(kwLabel)!;
      entry.totalMin += session.durationMin;
      if (session.phase) entry.notes.push(session.phase);
    }

    const weeklyBreakdowns: WeeklyBreakdown[] = [];
    for (const [kwLabel, data] of weekMap) {
      weeklyBreakdowns.push({ kwLabel, hours: data.totalMin / 60, note: [...new Set(data.notes)].join(', ') });
    }

    const fmUpdates = buildFrontmatterUpdates({
      title: frontmatterData.title || note.title,
      dateStarted: frontmatterData.date_started,
      dateFinished: frontmatterData.date_finished,
      currentPhase: frontmatterData.current_phase,
      totalMinutes, wordCount, weeklyBreakdowns,
    });

    const newBody = NoteManager.buildMarkdownTable(
      sessions, weeklyBreakdowns, totalMinutes, wordCount,
      note.body, { ...frontmatterData, ...fmUpdates },
    );
    await NoteManager.updateNoteBody(noteId, updateFrontmatter(newBody, fmUpdates));
  }
}
