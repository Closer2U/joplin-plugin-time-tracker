import type { SettingItem, SettingSection, ChangeEvent } from './types';

export default class JoplinSettings {
  registerSection(name: string, section: SettingSection): Promise<void>;
  registerSetting(key: string, settingItem: SettingItem): Promise<void>;
  registerSettings(settings: Record<string, SettingItem>): Promise<void>;
  value(key: string): Promise<unknown>;
  values(keys: string[] | string): Promise<Record<string, unknown>>;
  setValue(key: string, value: unknown): Promise<void>;
  onChange(handler: (event: ChangeEvent) => void): Promise<void>;
}
