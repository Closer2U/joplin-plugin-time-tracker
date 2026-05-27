export default class JoplinViews {
  get dialogs(): JoplinViewsDialogs;
  get panels(): JoplinViewsPanels;
  get menuItems(): JoplinViewsMenuItems;
  get menus(): JoplinViewsMenus;
  get toolbarButtons(): JoplinViewsToolbarButtons;
}

interface ViewHandle {}

interface JoplinViewsDialogs {
  create(id?: string): Promise<ViewHandle>;
  setHtml(handle: ViewHandle, html: string): Promise<void>;
  setButtons(handle: ViewHandle, buttons: Array<{ id: string; title?: string }>): Promise<void>;
  open(handle: ViewHandle): Promise<{ id: string; formData?: any }>;
  showMessageBox(message: string): Promise<number>;
}

interface JoplinViewsPanels {
  create(id: string): Promise<ViewHandle>;
  setHtml(handle: ViewHandle, html: string): Promise<void>;
  addScript(handle: ViewHandle, scriptPath: string): Promise<void>;
  show(handle: ViewHandle): Promise<void>;
  hide(handle: ViewHandle): Promise<void>;
  visible(handle: ViewHandle): Promise<boolean>;
  postMessage(handle: ViewHandle, message: any): Promise<void>;
  onMessage(handle: ViewHandle, callback: (message: any) => void): Promise<void>;
}

interface JoplinViewsMenuItems {
  create(id: string, commandName: string, location?: any, options?: any): Promise<void>;
}

interface JoplinViewsMenus {
  create(id: string, title: string, items: any[], options?: any): Promise<void>;
}

interface JoplinViewsToolbarButtons {
  create(id: string, commandName: string, location: any): Promise<void>;
}
