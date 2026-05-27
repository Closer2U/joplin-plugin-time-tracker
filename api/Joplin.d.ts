import type JoplinData from './JoplinData';
import type JoplinPlugins from './JoplinPlugins';
import type JoplinWorkspace from './JoplinWorkspace';
import type JoplinCommands from './JoplinCommands';
import type JoplinViews from './JoplinViews';
import type JoplinSettings from './JoplinSettings';
import type JoplinContentScripts from './JoplinContentScripts';
import type JoplinClipboard from './JoplinClipboard';

export default class Joplin {
  get data(): JoplinData;
  get clipboard(): JoplinClipboard;
  get plugins(): JoplinPlugins;
  get workspace(): JoplinWorkspace;
  get contentScripts(): JoplinContentScripts;
  get commands(): JoplinCommands;
  get views(): JoplinViews;
  get settings(): JoplinSettings;
  require(_path: string): any;
  versionInfo(): Promise<{ version: string; platform: string }>;
  shouldUseDarkColors(): Promise<boolean>;
}
