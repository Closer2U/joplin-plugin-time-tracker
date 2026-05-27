/**
 * Frontmatter parsing and updating utilities.
 */

import * as yaml from 'js-yaml';

export interface FrontmatterData {
  title?: string;
  link_to_story?: string;
  date_started?: string;
  date_finished?: string;
  current_phase?: string;
  time_total?: string;
  word_count?: number;
  time_per_thousand?: number;
  [key: string]: any;
}

export function extractFrontmatter(noteBody: string): { raw: string; data: FrontmatterData; body: string } | null {
  if (!noteBody) return null;
  const lines = noteBody.split('\n');
  if (lines[0].trim() !== '---') return null;
  let endIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') { endIndex = i; break; }
  }
  if (endIndex === -1) return null;
  const raw = lines.slice(1, endIndex).join('\n');
  const body = lines.slice(endIndex + 1).join('\n');
  let data: FrontmatterData = {};
  try {
    data = yaml.load(raw) as FrontmatterData || {};
  } catch (e) {
    console.warn('TimeTracker: Failed to parse YAML frontmatter:', e);
    data = {};
  }
  return { raw, data, body };
}

export function hasFrontmatter(noteBody: string): boolean {
  return noteBody.trimStart().startsWith('---');
}

export function updateFrontmatter(noteBody: string, updates: Record<string, any>): string {
  const existing = extractFrontmatter(noteBody);
  let data: FrontmatterData = {};
  let body: string;
  if (existing) {
    data = existing.data;
    body = existing.body;
  } else {
    body = noteBody;
  }
  for (const [key, value] of Object.entries(updates)) {
    data[key] = value;
  }
  const newRaw = yaml.dump(data, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
    quotingType: "'",
    forceQuotes: false,
  });
  return '---\n' + newRaw + '---\n' + body;
}

export function getFrontmatterValue<T = any>(noteBody: string, key: string, defaultValue?: T): T | undefined {
  const existing = extractFrontmatter(noteBody);
  if (!existing) return defaultValue;
  return (existing.data[key] as T) ?? defaultValue;
}

export function buildFrontmatterUpdates(trackingState: {
  title?: string;
  dateStarted?: string;
  dateFinished?: string;
  currentPhase?: string;
  totalMinutes: number;
  wordCount: number;
  weeklyBreakdowns: Array<{ kwLabel: string; hours: number; note: string }>;
}): Record<string, any> {
  const updates: Record<string, any> = {};
  if (trackingState.title !== undefined) updates.title = trackingState.title;
  if (trackingState.dateStarted !== undefined) updates.date_started = trackingState.dateStarted;
  if (trackingState.dateFinished !== undefined) updates.date_finished = trackingState.dateFinished;
  if (trackingState.currentPhase !== undefined) updates.current_phase = trackingState.currentPhase;
  const totalHours = Math.floor(trackingState.totalMinutes / 60);
  const totalMins = Math.floor(trackingState.totalMinutes % 60);
  updates.time_total = String(totalHours).padStart(2, '0') + ':' + String(totalMins).padStart(2, '0');
  if (trackingState.wordCount > 0) {
    updates.word_count = trackingState.wordCount;
    const tpt = Math.round(((1000 * (trackingState.totalMinutes / 60)) / trackingState.wordCount) * 10) / 10;
    updates.time_per_thousand = tpt;
  }
  for (const wb of trackingState.weeklyBreakdowns) {
    const match = wb.kwLabel.match(/KW\s*(\d{2})/i);
    if (match) {
      const kwNum = match[1];
      updates['hours_kw' + kwNum] = String(Math.floor(wb.hours)).padStart(2, '0') + ':' + String(Math.floor((wb.hours % 1) * 60)).padStart(2, '0');
      updates['note_kw' + kwNum] = wb.note || '';
    }
  }
  return updates;
}
