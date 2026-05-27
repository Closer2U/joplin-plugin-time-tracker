import type { Path, ModelType } from './types';

export default class JoplinData {
  get(path: Path, query?: Record<string, unknown>): Promise<any>;
  post(path: Path, query?: Record<string, unknown> | null, body?: unknown, files?: any[]): Promise<any>;
  put(path: Path, query?: Record<string, unknown> | null, body?: unknown, files?: any[]): Promise<any>;
  delete(path: Path, query?: Record<string, unknown>): Promise<any>;
  userDataGet<T>(itemType: ModelType, itemId: string, key: string): Promise<T>;
  userDataSet<T>(itemType: ModelType, itemId: string, key: string, value: T): Promise<void>;
  userDataDelete(itemType: ModelType, itemId: string, key: string): Promise<void>;
}
