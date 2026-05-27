export default class JoplinClipboard {
  readText(): Promise<string>;
  writeText(text: string): Promise<void>;
}
