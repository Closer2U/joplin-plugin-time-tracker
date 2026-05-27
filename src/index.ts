/**
 * Time Tracker Plugin for Joplin  —  v0.1.6
 */

import joplin from 'api';
import { MenuItemLocation } from 'api/types';
import {
  registerSettings, getTrackingTag, getStartOfWeek, getDefaultPhase,
  getPanelVisible, setPanelVisible,
} from './settings';
import {
  TimeSession, WeeklyBreakdown,
  formatDate, formatTime, getDayOfWeek, getKWLabel, parseDate,
} from './timeUtils';
import {
  extractFrontmatter, updateFrontmatter, buildFrontmatterUpdates, FrontmatterData,
} from './frontmatter';
import { NoteManager } from './noteManager';

// ---- Types ----
interface ActiveSession {
  noteId: string; startTime: Date; taskName: string; note: string;
}

// ---- State ----
const state: {
  panel: any;
  activeSession: ActiveSession | null;
  currentNoteId: string | null;
  trackingTag: string;
  startOfWeek: 'monday' | 'sunday';
  defaultPhase: string;
} = {
  panel: null, activeSession: null, currentNoteId: null,
  trackingTag: 'timeTrack', startOfWeek: 'monday', defaultPhase: 'first draft',
};

function today(): string { return formatDate(new Date()); }
function log(msg: string): void { console.log('[TimeTracker] ' + msg); }
function logErr(msg: string, e?: any): void { console.error('[TimeTracker] ' + msg, e || ''); }

// ---- Data helpers ----
async function getProjectData(noteId: string): Promise<{
  sessions: TimeSession[]; weeklyBreakdowns: WeeklyBreakdown[];
  totalMinutes: number; wordCount: number; currentPhase: string;
  dateStarted: string | null; dateFinished: string | null;
}> {
  const note = await NoteManager.getNote(noteId);
  if (!note) {
    return { sessions: [], weeklyBreakdowns: [], totalMinutes: 0,
      wordCount: 0, currentPhase: '', dateStarted: null, dateFinished: null };
  }
  const fm = extractFrontmatter(note.body);
  const fmData = fm?.data || {};
  const sessions = NoteManager.parseSessionsFromBody(note.body);
  const weeklyBreakdowns = NoteManager.parseWeeklyBreakdownsFromFrontmatter(fmData);
  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
  return {
    sessions, weeklyBreakdowns, totalMinutes,
    wordCount: (fmData.word_count as number) || 0,
    currentPhase: (fmData.current_phase as string) || '',
    dateStarted: (fmData.date_started as string) || null,
    dateFinished: (fmData.date_finished as string) || null,
  };
}

async function sendProjectDataToPanel(noteId: string): Promise<void> {
  try {
    const data = await getProjectData(noteId);
    await joplin.views.panels.postMessage(state.panel, {
      name: 'setProjectData', noteId,
      sessions: data.sessions, weeklyBreakdowns: data.weeklyBreakdowns,
      totalMinutes: data.totalMinutes, wordCount: data.wordCount,
      currentPhase: data.currentPhase,
      dateStarted: data.dateStarted, dateFinished: data.dateFinished,
    });
  } catch (e: any) { logErr('sendProjectDataToPanel', e); }
}

async function addSession(
  noteId: string, date: string, startTime: string, endTime: string,
  durationMin: number, phase: string,
): Promise<void> {
  const note = await NoteManager.getNote(noteId);
  if (!note) { logErr('addSession: note not found: ' + noteId); return; }

  const fm = extractFrontmatter(note.body);
  const fmData: FrontmatterData = fm?.data || {};
  const sessions = NoteManager.parseSessionsFromBody(note.body);
  const dateObj = parseDate(date);
  sessions.push({
    date, weekday: dateObj ? getDayOfWeek(dateObj, state.startOfWeek) : '',
    start: startTime, end: endTime, durationMin, phase,
  });
  sessions.sort((a, b) => {
    const da = parseDate(a.date), db = parseDate(b.date);
    if (!da || !db) return 0;
    if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
    return a.start.localeCompare(b.start);
  });

  const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);

  const weekMap = new Map<string, { totalMin: number; notes: string[] }>();
  for (const session of sessions) {
    const d = parseDate(session.date);
    if (!d) continue;
    const kwLabel = getKWLabel(d);
    if (!weekMap.has(kwLabel)) weekMap.set(kwLabel, { totalMin: 0, notes: [] });
    const entry = weekMap.get(kwLabel)!;
    entry.totalMin += session.durationMin;
    if (session.phase) entry.notes.push(session.phase);
  }

  const weeklyBreakdowns: WeeklyBreakdown[] = [];
  for (const [kwLabel, data] of weekMap) {
    weeklyBreakdowns.push({ kwLabel, hours: data.totalMin / 60, note: [...new Set(data.notes)].join(', ') });
  }

  const wordCount = (fmData.word_count as number) || 0;
  const fmUpdates = buildFrontmatterUpdates({
    title: (fmData.title as string) || note.title,
    dateStarted: (fmData.date_started as string) || date,
    dateFinished: fmData.date_finished as string | undefined,
    currentPhase: phase || (fmData.current_phase as string) || state.defaultPhase,
    totalMinutes, wordCount, weeklyBreakdowns,
  });

  const finalBody = updateFrontmatter(
    NoteManager.buildMarkdownTable(
      sessions, weeklyBreakdowns, totalMinutes, wordCount,
      note.body, { ...fmData, ...fmUpdates },
    ), fmUpdates,
  );
  await NoteManager.updateNoteBody(noteId, finalBody);
  await sendProjectDataToPanel(noteId);
}

// ---- Panel setup ----
async function setupPanel(): Promise<any> {
  // Step 1: create panel handle
  const panel = await joplin.views.panels.create('timeTrackerPanel');
  log('Panel handle created');

  // Step 2: register message handler BEFORE setting HTML/scripts
  // This prevents race: if the webview fires 'init' before this point, it's buffered
  // and delivered once the handler is registered.
  await joplin.views.panels.onMessage(panel, handlePanelMessage);
  log('Message handler registered (before scripts load)');

  // Step 3: set HTML content
  const html = `
<div class="time-tracker-container">
  <div class="time-tracker-header">
    <span class="icon">⏱️</span>
    <span>Time Tracker</span>
  </div>

  <div id="message-area"></div>

  <div class="project-selector">
    <label>Project</label>
    <div style="display:flex;gap:6px;">
      <select id="project-select" style="flex:1;">
        <option value="">— Select a project —</option>
      </select>
      <button id="btn-refresh" class="btn btn-refresh" style="flex:0;padding:6px 10px;" title="Refresh project list">🔄</button>
    </div>
  </div>

  <div class="timer-display" id="timer-display">
    <div>
      <div class="timer-time" id="timer-time">00:00:00</div>
      <div class="timer-status" id="timer-status">No active session</div>
    </div>
  </div>

  <div class="button-row">
    <button id="btn-start" class="btn btn-start" disabled>▶ Start</button>
    <button id="btn-stop" class="btn btn-stop" disabled>⏹ Stop</button>
  </div>

  <div class="input-group">
    <label>Phase / Task</label>
    <input type="text" id="input-phase" placeholder="e.g., first draft, revision..." />
  </div>

  <div class="input-group">
    <label>Session Note (optional)</label>
    <input type="text" id="input-note" placeholder="What are you working on?" />
  </div>

  <div class="input-row">
    <div class="input-group">
      <label>Word Count</label>
      <input type="number" id="input-wordcount" placeholder="e.g., 5000" min="0" />
    </div>
    <div class="checkbox-group" style="align-self:flex-end;margin-bottom:2px;">
      <input type="checkbox" id="chk-finished" />
      <label for="chk-finished">Project finished</label>
    </div>
  </div>

  <button id="btn-finish" class="btn btn-finish" disabled>✓ Update / Finish Project</button>

  <div class="stats-grid">
    <div class="stat-card"><div class="stat-value" id="stat-total">00:00</div><div class="stat-label">Total Time</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-tpt">—</div><div class="stat-label">TpT (h/1k words)</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-sessions">0</div><div class="stat-label">Sessions</div></div>
    <div class="stat-card"><div class="stat-value" id="stat-weekly">—</div><div class="stat-label">Weeks Tracked</div></div>
  </div>

  <div>
    <h4 style="margin:0 0 6px 0;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;color:var(--joplin-color-faded);">Recent Sessions</h4>
    <div class="session-list" id="session-list"></div>
  </div>

  <div class="weekly-section">
    <h4>Weekly Breakdown</h4>
    <div id="weekly-list"></div>
  </div>
</div>
`;

  await joplin.views.panels.setHtml(panel, html);
  log('HTML set');

  await joplin.views.panels.addScript(panel, './ui/panel.css');
  await joplin.views.panels.addScript(panel, './ui/panel.js');
  log('Scripts added, panel ready');

  return panel;
}

// ---- Message handler ----
async function handlePanelMessage(message: any): Promise<void> {
  if (!message || !message.name) return;
  try {
    switch (message.name) {
      case 'init': {
        log('Panel init received');
        await pushProjectList();
        if (state.activeSession) {
          await joplin.views.panels.postMessage(state.panel, {
            name: 'activeSessionState', isActive: true,
            startTime: state.activeSession.startTime.toISOString(),
            taskName: state.activeSession.taskName, note: state.activeSession.note,
          });
        }
        break;
      }
      case 'refreshProjects': { await pushProjectList(); break; }
      case 'selectProject': {
        state.currentNoteId = message.noteId;
        if (message.noteId) await sendProjectDataToPanel(message.noteId);
        break;
      }
      case 'startTracking': {
        const noteId = message.noteId;
        if (!noteId) {
          await joplin.views.panels.postMessage(state.panel, { name: 'error', message: 'No project selected.' });
          break;
        }
        state.activeSession = {
          noteId, startTime: new Date(),
          taskName: message.taskName || 'working', note: message.note || '',
        };
        log('Started: ' + message.taskName + ' on note ' + noteId);
        break;
      }
      case 'stopTracking': {
        if (!state.activeSession) {
          await joplin.views.panels.postMessage(state.panel, { name: 'error', message: 'No active session to stop.' });
          break;
        }
        const session = state.activeSession;
        const elapsedMinutes = message.elapsedMinutes || 0;
        const endTime = new Date();
        const startTime = session.startTime;
        await addSession(
          session.noteId, formatDate(startTime), formatTime(startTime),
          formatTime(endTime), elapsedMinutes, session.taskName,
        );
        log('Stopped: ' + elapsedMinutes + ' min logged');
        state.activeSession = null;
        await joplin.views.panels.postMessage(state.panel, { name: 'sessionSaved', elapsedMinutes });
        break;
      }
      case 'updateWordCount': {
        const noteId = message.noteId;
        const wordCount = message.wordCount || 0;
        if (!noteId) break;
        const note = await NoteManager.getNote(noteId);
        if (!note) break;
        const sessions = NoteManager.parseSessionsFromBody(note.body);
        const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
        const updates: Record<string, any> = { word_count: wordCount };
        if (wordCount > 0 && totalMinutes > 0) {
          updates.time_per_thousand = Math.round(((1000 * (totalMinutes / 60)) / wordCount) * 10) / 10;
        }
        await NoteManager.updateNoteBody(noteId, updateFrontmatter(note.body, updates));
        await sendProjectDataToPanel(noteId);
        break;
      }
      case 'finishProject': {
        const noteId = message.noteId;
        if (!noteId) break;
        const finished = message.finished;
        const wordCount = message.wordCount || 0;
        const note = await NoteManager.getNote(noteId);
        if (!note) break;
        const sessions = NoteManager.parseSessionsFromBody(note.body);
        const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
        const updates: Record<string, any> = {};
        if (wordCount > 0) updates.word_count = wordCount;
        updates.date_finished = finished ? today() : null;
        if (wordCount > 0 && totalMinutes > 0) {
          updates.time_per_thousand = Math.round(((1000 * (totalMinutes / 60)) / wordCount) * 10) / 10;
        }
        await NoteManager.updateNoteBody(noteId, updateFrontmatter(note.body, updates));
        await joplin.views.panels.postMessage(state.panel, { name: 'projectFinished' });
        await sendProjectDataToPanel(noteId);
        break;
      }
    }
  } catch (error: any) {
    logErr('handlePanelMessage error', error);
    try {
      await joplin.views.panels.postMessage(state.panel, { name: 'error', message: error.message || 'Unexpected error' });
    } catch (_) {}
  }
}

async function pushProjectList(): Promise<void> {
  try {
    log('pushProjectList: searching for tag "' + state.trackingTag + '"');
    const projects = await NoteManager.findNotesByTag(state.trackingTag);
    log('pushProjectList: found ' + projects.length + ' project(s)');
    await joplin.views.panels.postMessage(state.panel, {
      name: 'setProjects',
      projects: projects.map((p) => ({ id: p.id, title: p.title })),
    });
  } catch (e: any) { logErr('pushProjectList failed', e); }
}

// ---- Plugin entry point ----
joplin.plugins.register({
  onStart: async function () {
    try {
      log('Starting v0.1.6...');

      // 1. Register settings
      await registerSettings();
      state.trackingTag = await getTrackingTag();
      state.startOfWeek = await getStartOfWeek();
      state.defaultPhase = await getDefaultPhase();
      log('Settings loaded: tag=' + state.trackingTag);

      // 2. Create panel (registers onMessage BEFORE scripts load)
      state.panel = await setupPanel();

      // 3. Restore panel visibility
      const wasVisible = await getPanelVisible();
      if (wasVisible) {
        try {
          await joplin.views.panels.show(state.panel);
          log('Panel restored to visible');
        } catch (e: any) { logErr('Could not show panel on startup', e); }
      } else {
        log('Panel stays hidden (user closed it last time)');
      }

      // 4. PROACTIVELY push project list (doesn't wait for init message)
      await pushProjectList();

      // 5. Toggle panel command
      await joplin.commands.register({
        name: 'timetracker.togglePanel',
        label: 'Toggle Time Tracker panel',
        iconName: 'fas fa-stopwatch',
        execute: async () => {
          try {
            const isVisible = await joplin.views.panels.visible(state.panel);
            if (isVisible) {
              await joplin.views.panels.hide(state.panel);
              await setPanelVisible(false);
            } else {
              await joplin.views.panels.show(state.panel);
              await setPanelVisible(true);
            }
          } catch (e: any) { logErr('toggle panel failed', e); }
        },
      });

      await joplin.views.menuItems.create(
        'timetracker.togglePanelMenuItem',
        'timetracker.togglePanel',
        MenuItemLocation.View,
      );
      log('View > Toggle Time Tracker panel registered');

      // 6. Recalculate command
      await joplin.commands.register({
        name: 'timetracker.recalculate',
        label: 'Recalculate Time Tracker data',
        iconName: 'fas fa-calculator',
        execute: async () => {
          try {
            const selectedNote = await joplin.workspace.selectedNote();
            if (!selectedNote) {
              await joplin.views.dialogs.showMessageBox('Please select a note with time tracking data first.');
              return;
            }
            const sessions = NoteManager.parseSessionsFromBody(selectedNote.body);
            const fm = extractFrontmatter(selectedNote.body);
            const wordCount = (fm?.data?.word_count as number) || 0;
            await NoteManager.recalculateAndUpdate(selectedNote.id, sessions, wordCount);
            const totalMinutes = sessions.reduce((sum, s) => sum + s.durationMin, 0);
            await joplin.views.panels.postMessage(state.panel, { name: 'recalculated', totalMinutes });
          } catch (e: any) {
            logErr('recalculate failed', e);
            await joplin.views.dialogs.showMessageBox('Recalculate failed: ' + (e.message || 'Unknown error'));
          }
        },
      });

      await joplin.views.menuItems.create(
        'timetracker.recalculateMenuItem',
        'timetracker.recalculate',
        MenuItemLocation.Tools,
      );
      log('Tools > Recalculate Time Tracker data registered');

      // 7. Settings change listener
      await joplin.settings.onChange(async (event: any) => {
        if (event.keys.includes('timeTracker.trackingTag')) {
          state.trackingTag = await getTrackingTag();
          log('Tag changed to: ' + state.trackingTag);
        }
        if (event.keys.includes('timeTracker.startOfWeek')) {
          state.startOfWeek = await getStartOfWeek();
        }
        if (event.keys.includes('timeTracker.defaultPhase')) {
          state.defaultPhase = await getDefaultPhase();
        }
      });

      log('Plugin v0.1.6 started!');

    } catch (error: any) {
      logErr('FATAL onStart', error);
      try {
        await joplin.views.dialogs.showMessageBox(
          'Time Tracker failed to start: ' + (error.message || 'Unknown error'),
        );
      } catch (_) {}
    }
  },
});
