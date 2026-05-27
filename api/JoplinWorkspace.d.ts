export default class JoplinWorkspace {
  selectedNote(): Promise<any>;
  selectedFolder(): Promise<any>;
  selectedNoteIds(): Promise<string[]>;
  onNoteSelectionChange(callback: (...args: any[]) => void): Promise<any>;
  onNoteChange(handler: (...args: any[]) => void): Promise<any>;
  onSyncComplete(callback: (...args: any[]) => void): Promise<any>;
}
