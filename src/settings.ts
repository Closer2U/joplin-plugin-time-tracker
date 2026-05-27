/**
 * Plugin settings registration and access.
 */

import joplin from 'api';

const SETTINGS_SECTION = 'timeTrackerSection';

export const SETTING_TRACKING_TAG = 'timeTracker.trackingTag';
export const SETTING_START_OF_WEEK = 'timeTracker.startOfWeek';
export const SETTING_DEFAULT_PHASE = 'timeTracker.defaultPhase';
export const SETTING_PANEL_VISIBLE = 'timeTracker.panelVisible';

export async function registerSettings(): Promise<void> {
  await joplin.settings.registerSection(SETTINGS_SECTION, {
    label: 'Time Tracker',
    iconName: 'fas fa-stopwatch',
  });

  await joplin.settings.registerSettings({
    [SETTING_TRACKING_TAG]: {
      value: 'timeTrack',
      type: 2,
      section: SETTINGS_SECTION,
      public: true,
      label: 'Tracking tag',
      description: 'Notes tagged with this tag will appear in the time tracker dropdown. Default: timeTrack',
    },
    [SETTING_START_OF_WEEK]: {
      value: 'monday',
      type: 3,
      section: SETTINGS_SECTION,
      public: true,
      label: 'Start of week',
      description: 'Which day the calendar week starts on for weekly breakdown calculations.',
      isEnum: true,
      options: {
        'monday': 'Monday',
        'sunday': 'Sunday',
      },
    },
    [SETTING_DEFAULT_PHASE]: {
      value: 'first draft',
      type: 2,
      section: SETTINGS_SECTION,
      public: true,
      label: 'Default phase',
      description: 'Default phase/task label when starting a new tracking session.',
    },
    [SETTING_PANEL_VISIBLE]: {
      value: true,
      type: 1,  // bool
      section: SETTINGS_SECTION,
      public: false,  // hidden — not user-facing
      label: 'Panel visible',
      description: 'Internal: whether the panel was last shown or hidden.',
    },
  });
}

export async function getTrackingTag(): Promise<string> {
  return (await joplin.settings.value(SETTING_TRACKING_TAG)) as string || 'timeTrack';
}

export async function getStartOfWeek(): Promise<'monday' | 'sunday'> {
  const val = await joplin.settings.value(SETTING_START_OF_WEEK);
  return (val === 'sunday' ? 'sunday' : 'monday');
}

export async function getDefaultPhase(): Promise<string> {
  return (await joplin.settings.value(SETTING_DEFAULT_PHASE)) as string || 'first draft';
}

export async function getPanelVisible(): Promise<boolean> {
  const v = await joplin.settings.value(SETTING_PANEL_VISIBLE);
  return v !== false;  // default true
}

export async function setPanelVisible(v: boolean): Promise<void> {
  await joplin.settings.setValue(SETTING_PANEL_VISIBLE, v);
}
