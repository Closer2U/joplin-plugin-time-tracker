/**
 * Time utility functions for the Time Tracker plugin.
 */

export interface TimeSession {
  date: string;
  weekday: string;
  start: string;
  end: string;
  durationMin: number;
  phase: string;
}

export interface WeeklyBreakdown {
  kwLabel: string;
  hours: number;
  note: string;
}

export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr || !timeStr.includes(':')) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

export function minutesToHHMM(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const absMin = Math.abs(totalMinutes);
  const h = Math.floor(absMin / 60);
  const m = Math.floor(absMin % 60);
  return sign + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
}

export function minutesToDecimalHours(totalMinutes: number): number {
  return Math.round((totalMinutes / 60) * 100) / 100;
}

export function calculateDuration(startTime: string, endTime: string): number {
  const startMin = parseTimeToMinutes(startTime);
  let endMin = parseTimeToMinutes(endTime);
  if (endMin < startMin) endMin += 24 * 60;
  return endMin - startMin;
}

export function getCalendarWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

export function getCalendarWeekYear(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

export function getKWLabel(date: Date): string {
  const year = getCalendarWeekYear(date) % 100;
  const kw = getCalendarWeek(date);
  return String(year).padStart(2, '0') + ' KW ' + String(kw).padStart(2, '0');
}

export function getHoursKWKey(date: Date): string {
  const kw = getCalendarWeek(date);
  return 'hours_kw' + String(kw).padStart(2, '0');
}

export function getNoteKWKey(date: Date): string {
  const kw = getCalendarWeek(date);
  return 'note_kw' + String(kw).padStart(2, '0');
}

export function getDayOfWeek(date: Date, startOfWeek: 'monday' | 'sunday' = 'monday'): string {
  const days = startOfWeek === 'monday'
    ? ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    : ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[date.getDay() === 0 && startOfWeek === 'monday' ? 6 : date.getDay()];
}

export function formatDate(date: Date): string {
  const d = String(date.getDate()).padStart(2, '0');
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = String(date.getFullYear()).slice(-2);
  return d + '.' + m + '.' + y;
}

export function formatTime(date: Date): string {
  const h = String(date.getHours()).padStart(2, '0');
  const m = String(date.getMinutes()).padStart(2, '0');
  return h + ':' + m;
}

export function parseDate(dateStr: string): Date | null {
  if (!dateStr || !dateStr.includes('.')) return null;
  const parts = dateStr.split('.');
  if (parts.length !== 3) return null;
  const d = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10) - 1;
  let y = parseInt(parts[2], 10);
  if (y < 100) y += 2000;
  const date = new Date(y, m, d);
  if (isNaN(date.getTime())) return null;
  return date;
}

export function calculateTpT(totalMinutes: number, wordCount: number): number {
  if (wordCount <= 0) return 0;
  const totalHours = totalMinutes / 60;
  return Math.round(((1000 * totalHours) / wordCount) * 10) / 10;
}

export function groupByWeek(
  sessions: TimeSession[],
  startOfWeek: 'monday' | 'sunday' = 'monday'
): Map<string, { sessions: TimeSession[]; totalMin: number }> {
  const weeks = new Map<string, { sessions: TimeSession[]; totalMin: number }>();
  for (const session of sessions) {
    const date = parseDate(session.date);
    if (!date) continue;
    const kwLabel = getKWLabel(date);
    if (!weeks.has(kwLabel)) weeks.set(kwLabel, { sessions: [], totalMin: 0 });
    const week = weeks.get(kwLabel)!;
    week.sessions.push(session);
    week.totalMin += session.durationMin;
  }
  return weeks;
}

export function formatTpT(totalMinutes: number, wordCount: number): string {
  if (wordCount <= 0) return '~0 h';
  const tpt = calculateTpT(totalMinutes, wordCount);
  return '~' + tpt.toFixed(1).replace('.', ',') + ' h';
}

export function getWeekBoundaries(date: Date, startOfWeek: 'monday' | 'sunday' = 'monday'): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  let diffToStart: number;
  if (startOfWeek === 'monday') {
    diffToStart = day === 0 ? -6 : 1 - day;
  } else {
    diffToStart = -day;
  }
  const start = new Date(d);
  start.setDate(d.getDate() + diffToStart);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}
