export type StoredObject = {
  key: string;
  contentType: string;
  size: number;
};

export interface StorageProvider {
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<Uint8Array | null>;
  delete(key: string): Promise<void>;
}

export class InMemoryStorageProvider implements StorageProvider {
  private readonly objects = new Map<string, Uint8Array>();

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    const copy = body.slice();
    this.objects.set(key, copy);
    return { key, contentType, size: copy.byteLength };
  }

  async get(key: string): Promise<Uint8Array | null> {
    return this.objects.get(key)?.slice() ?? null;
  }

  async delete(key: string): Promise<void> {
    this.objects.delete(key);
  }
}
