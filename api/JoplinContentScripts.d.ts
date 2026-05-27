import type { ContentScriptType } from './types';

export default class JoplinContentScripts {
  register(type: ContentScriptType, id: string, scriptPath: string): Promise<void>;
  onMessage(scriptId: string, callback: (message: any) => any): Promise<void>;
}
