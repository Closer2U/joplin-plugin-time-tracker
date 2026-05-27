export default class JoplinPlugins {
  register(script: { onStart(...args: any[]): Promise<void> }): Promise<void>;
  dataDir(): Promise<string>;
}
