export interface StoreObjectInput {
  buffer: Buffer
  mimeType: string
  /** Subfolder under the upload root, e.g. `comments`. */
  folder: string
  originalName: string
}

export interface StoredObject {
  /** Path relative to the upload root, used for later deletion. */
  relativePath: string
  /** Absolute URL clients can put in an <img src>. */
  publicUrl: string
}

/**
 * Binary object store. Today a local disk folder; later an S3 bucket without
 * changing anything that depends on this port.
 */
export interface ObjectStorage {
  store(input: StoreObjectInput): Promise<StoredObject>

  delete(relativePath: string): Promise<void>
}

export const OBJECT_STORAGE = Symbol('ObjectStorage')
