export type Path = string[];

export enum ModelType {
  Note = 1,
  Folder = 2,
  Tag = 5,
}

export enum MenuItemLocation {
  File = 'file',
  Edit = 'edit',
  View = 'view',
  Note = 'note',
  Tools = 'tools',
  Help = 'help',
  Context = 'context',
}

export enum ToolbarButtonLocation {
  EditorToolbar = 'editorToolbar',
  NoteToolbar = 'noteToolbar',
}

export enum ContentScriptType {
  CodeMirrorPlugin = 'codeMirrorPlugin',
  MarkdownItPlugin = 'markdownItPlugin',
}

export interface Command {
  name: string;
  label?: string;
  iconName?: string;
  execute(...args: any[]): Promise<any>;
  enabledCondition?: string;
}

export interface SettingItem {
  value: unknown;
  type: number;
  section: string;
  public: boolean;
  label: string;
  description?: string;
  isEnum?: boolean;
  options?: Record<string, string>;
}

export interface SettingSection {
  label: string;
  iconName?: string;
  description?: string;
}

export interface ChangeEvent {
  keys: string[];
}
