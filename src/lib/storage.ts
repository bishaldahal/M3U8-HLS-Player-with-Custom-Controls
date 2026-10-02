import { ext } from './browser';

export interface KeyValueStorage {
  get(keys: string[]): Promise<Record<string, unknown>>;
  set(items: Record<string, unknown>): Promise<void>;
  getBytesInUse?(keys: string[]): Promise<number>;
}

let backend: KeyValueStorage | null = null;

export function getStorage(): KeyValueStorage {
  backend ??= {
    get: (keys) => ext.storage.local.get(keys),
    set: (items) => ext.storage.local.set(items),
    getBytesInUse: (keys) => ext.storage.local.getBytesInUse?.(keys) ?? Promise.resolve(0),
  };
  return backend;
}

/** Test hook: swap the storage implementation. */
export function setStorage(storage: KeyValueStorage | null): void {
  backend = storage;
}
