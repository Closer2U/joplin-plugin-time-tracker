/**
 * Time Tracker Panel UI v0.1.6
 */
(function() {
  'use strict';

  var state = {
    projects: [],
    selectedProjectId: null,
    activeSession: null,
    sessions: [],
    weeklyBreakdowns: [],
    totalMinutes: 0,
    wordCount: 0,
    currentPhase: 'first draft',
    dateStarted: null,
    dateFinished: null,
    timerInterval: null,
    elapsedSeconds: 0,
  };

  var el = {};

  // DEBUG helper
  function dbg(label, data) {
    console.log('[TT-PANEL] ' + label, data || '');
  }

  function cacheElements() {
    el.projectSelect = document.getElementById('project-select');
    el.refreshBtn = document.getElementById('btn-refresh');
    el.timerDisplay = document.getElementById('timer-display');
    el.timerTime = document.getElementById('timer-time');
    el.timerStatus = document.getElementById('timer-status');
    el.btnStart = document.getElementById('btn-start');
    el.btnStop = document.getElementById('btn-stop');
    el.btnFinish = document.getElementById('btn-finish');
    el.inputPhase = document.getElementById('input-phase');
    el.inputNote = document.getElementById('input-note');
    el.inputWordCount = document.getElementById('input-wordcount');
    el.chkFinished = document.getElementById('chk-finished');
    el.statTotal = document.getElementById('stat-total');
    el.statTpt = document.getElementById('stat-tpt');
    el.statSessions = document.getElementById('stat-sessions');
    el.statWeekly = document.getElementById('stat-weekly');
    el.sessionList = document.getElementById('session-list');
    el.weeklyList = document.getElementById('weekly-list');
    el.messageArea = document.getElementById('message-area');
  }

  function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function pad(n, width) { var s = String(n); while (s.length < width) s = '0' + s; return s; }

  function minutesToHHMM(totalMinutes) {
    var sign = totalMinutes < 0 ? '-' : '';
    var absMin = Math.abs(totalMinutes);
    var h = Math.floor(absMin / 60);
    var m = Math.floor(absMin % 60);
    return sign + pad(h, 2) + ':' + pad(m, 2);
  }

  function secondsToHHMMSS(totalSeconds) {
    var h = Math.floor(totalSeconds / 3600);
    var m = Math.floor((totalSeconds % 3600) / 60);
    var s = Math.floor(totalSeconds % 60);
    return pad(h, 2) + ':' + pad(m, 2) + ':' + pad(s, 2);
  }

  function showMessage(text, type) {
    if (!el.messageArea) return;
    type = type || 'info';
    el.messageArea.innerHTML = '<div class="message message-' + type + '">' + escapeHtml(text) + '</div>';
    if (type === 'success') {
      setTimeout(function() { if (el.messageArea) el.messageArea.innerHTML = ''; }, 3000);
    }
  }

  function startTimerDisplay() {
    if (state.timerInterval) return;
    state.elapsedSeconds = 0;
    updateTimerDisplay();
    state.timerInterval = setInterval(function() { state.elapsedSeconds++; updateTimerDisplay(); }, 1000);
    el.timerDisplay.classList.add('active');
    el.timerTime.classList.add('active');
    el.timerStatus.textContent = '● Tracking: ' + escapeHtml(state.activeSession.taskName || 'Working');
  }

  function stopTimerDisplay() {
    if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
    el.timerDisplay.classList.remove('active');
    el.timerTime.classList.remove('active');
    el.timerStatus.textContent = 'No active session';
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    el.timerTime.textContent = state.timerInterval ? secondsToHHMMSS(state.elapsedSeconds) : '00:00:00';
  }

  function renderProjectList() {
    var select = el.projectSelect;
    select.innerHTML = '<option value="">— Select a project —</option>';
    for (var i = 0; i < state.projects.length; i++) {
      var proj = state.projects[i];
      var sel = proj.id === state.selectedProjectId ? ' selected' : '';
      select.innerHTML += '<option value="' + escapeHtml(proj.id) + '"' + sel + '>' + escapeHtml(proj.title) + '</option>';
    }
  }

  function renderStats() {
    el.statTotal.textContent = minutesToHHMM(state.totalMinutes);
    el.statSessions.textContent = state.sessions.length;
    el.statWeekly.textContent = state.weeklyBreakdowns.length > 0 ? state.weeklyBreakdowns.length + ' weeks' : '—';
    if (state.wordCount > 0 && state.totalMinutes > 0) {
      var tpt = Math.round(((1000 * (state.totalMinutes / 60)) / state.wordCount) * 10) / 10;
      el.statTpt.textContent = '~' + String(tpt).replace('.', ',') + ' h';
    } else {
      el.statTpt.textContent = '—';
    }
  }

  function renderSessions() {
    if (!el.sessionList) return;
    var html = '';
    var sessions = state.sessions.slice().reverse();
    if (sessions.length === 0) {
      html = '<div style="color:var(--joplin-color-faded);text-align:center;padding:12px;">No sessions logged yet.</div>';
    } else {
      for (var i = 0; i < sessions.length; i++) {
        var s = sessions[i];
        html += '<div class="session-item">';
        html += '<span class="session-date">' + escapeHtml(s.date) + '</span>';
        html += '<span class="session-time">' + escapeHtml(s.start) + ' – ' + escapeHtml(s.end) + '</span>';
        html += '<span class="session-duration">' + minutesToHHMM(s.durationMin) + '</span>';
        if (s.phase) html += '<span class="session-phase">' + escapeHtml(s.phase) + '</span>';
        html += '</div>';
      }
    }
    el.sessionList.innerHTML = html;
  }

  function renderWeeklyBreakdowns() {
    if (!el.weeklyList) return;
    var html = '';
    if (state.weeklyBreakdowns.length === 0) {
      html = '<div style="color:var(--joplin-color-faded);text-align:center;padding:8px;">No weekly data yet.</div>';
    } else {
      for (var i = 0; i < state.weeklyBreakdowns.length; i++) {
        var wb = state.weeklyBreakdowns[i];
        html += '<div class="weekly-row">';
        html += '<span class="weekly-kw">' + escapeHtml(wb.kwLabel) + '</span>';
        html += '<span class="weekly-hours">' + minutesToHHMM(Math.round(wb.hours * 60)) + '</span>';
        html += '</div>';
      }
    }
    el.weeklyList.innerHTML = html;
  }

  function refreshUI() {
    renderProjectList();
    renderStats();
    renderSessions();
    renderWeeklyBreakdowns();
    el.btnStart.disabled = !state.selectedProjectId || !!state.timerInterval;
    el.btnStop.disabled = !state.timerInterval;
    el.btnFinish.disabled = !state.selectedProjectId;
    if (state.currentPhase) el.inputPhase.value = state.currentPhase;
    el.inputWordCount.value = state.wordCount || '';
  }

  function selectProject(projectId) {
    state.selectedProjectId = projectId;
    el.projectSelect.value = projectId || '';
    if (projectId) {
      dbg('selecting project', projectId);
      webviewApi.postMessage({ name: 'selectProject', noteId: projectId });
    } else {
      state.sessions = []; state.weeklyBreakdowns = []; state.totalMinutes = 0;
      state.wordCount = 0; state.currentPhase = ''; state.dateStarted = null; state.dateFinished = null;
      refreshUI();
    }
  }

  function startTracking() {
    if (!state.selectedProjectId) return;
    var taskName = el.inputPhase.value.trim() || 'working';
    state.activeSession = { startTime: new Date().toISOString(), taskName: taskName, note: el.inputNote.value.trim() || '' };
    startTimerDisplay();
    el.btnStart.disabled = true; el.btnStop.disabled = false;
    webviewApi.postMessage({ name: 'startTracking', noteId: state.selectedProjectId, taskName: taskName, note: state.activeSession.note });
  }

  function stopTracking() {
    if (!state.activeSession) return;
    var elapsedMin = Math.floor(state.elapsedSeconds / 60);
    stopTimerDisplay();
    webviewApi.postMessage({ name: 'stopTracking', noteId: state.selectedProjectId, taskName: state.activeSession.taskName, note: state.activeSession.note, elapsedMinutes: elapsedMin });
    state.activeSession = null;
    el.btnStart.disabled = !state.selectedProjectId; el.btnStop.disabled = true;
  }

  function finishProject() {
    if (!state.selectedProjectId) return;
    webviewApi.postMessage({ name: 'finishProject', noteId: state.selectedProjectId, finished: el.chkFinished.checked, wordCount: parseInt(el.inputWordCount.value, 10) || 0 });
  }

  function setupEventListeners() {
    el.projectSelect.addEventListener('change', function() { selectProject(el.projectSelect.value); });
    el.refreshBtn.addEventListener('click', function() { webviewApi.postMessage({ name: 'refreshProjects' }); });
    el.btnStart.addEventListener('click', startTracking);
    el.btnStop.addEventListener('click', stopTracking);
    el.btnFinish.addEventListener('click', finishProject);
    el.inputWordCount.addEventListener('change', function() {
      if (!state.selectedProjectId) return;
      webviewApi.postMessage({ name: 'updateWordCount', noteId: state.selectedProjectId, wordCount: parseInt(el.inputWordCount.value, 10) || 0 });
    });
    el.chkFinished.addEventListener('change', function() {
      if (el.chkFinished.checked) showMessage('Marking project as finished will set date_finished to today.', 'info');
    });
  }

  // Message handler — accepts both wrapped and unwrapped forms
  webviewApi.onMessage(function(raw) {
    var message = raw;
    // Time Slip-style wrapping: event.message
    if (raw && raw.message && typeof raw.message.name === 'string') {
      message = raw.message;
      dbg('unwrapped event.message');
    }
    dbg('onMessage received', message.name);
    if (!message || !message.name) return;

    switch (message.name) {
      case 'setProjects':
        dbg('setProjects count', (message.projects || []).length);
        state.projects = message.projects || [];
        refreshUI();
        break;
      case 'setProjectData':
        state.selectedProjectId = message.noteId;
        state.sessions = message.sessions || [];
        state.weeklyBreakdowns = message.weeklyBreakdowns || [];
        state.totalMinutes = message.totalMinutes || 0;
        state.wordCount = message.wordCount || 0;
        state.currentPhase = message.currentPhase || '';
        state.dateStarted = message.dateStarted || null;
        state.dateFinished = message.dateFinished || null;
        el.projectSelect.value = message.noteId || '';
        refreshUI();
        break;
      case 'sessionSaved':
        showMessage('Session saved! (' + minutesToHHMM(message.elapsedMinutes || 0) + ')', 'success');
        if (state.selectedProjectId) webviewApi.postMessage({ name: 'selectProject', noteId: state.selectedProjectId });
        break;
      case 'projectFinished':
        showMessage('Project marked as finished!', 'success');
        if (state.selectedProjectId) webviewApi.postMessage({ name: 'selectProject', noteId: state.selectedProjectId });
        break;
      case 'recalculated':
        showMessage('Recalculated! Total: ' + minutesToHHMM(message.totalMinutes || 0), 'success');
        if (state.selectedProjectId) webviewApi.postMessage({ name: 'selectProject', noteId: state.selectedProjectId });
        break;
      case 'error':
        showMessage(message.message || 'Error', 'error');
        break;
      case 'activeSessionState':
        if (message.isActive && message.startTime && message.taskName) {
          state.activeSession = { startTime: message.startTime, taskName: message.taskName, note: message.note || '' };
          var start = new Date(message.startTime).getTime();
          state.elapsedSeconds = Math.floor((new Date().getTime() - start) / 1000);
          startTimerDisplay();
          el.btnStart.disabled = true; el.btnStop.disabled = false;
        }
        break;
      default:
        dbg('unhandled message', message.name);
    }
  });

  function init() {
    dbg('init called');
    cacheElements();
    setupEventListeners();
    updateTimerDisplay();
    dbg('sending init message to plugin');
    webviewApi.postMessage({ name: 'init' });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
