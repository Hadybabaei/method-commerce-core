import { StoredObject } from './object-storage.port'

/**
 * Takes uploaded image bytes and returns a public URL. The comments use case
 * never talks to the filesystem — only to this port.
 */
export interface ImageUploader {
  /**
   * Persists every file under `folder` and returns them in the same order.
   * Rejects the whole batch if any file is the wrong type or too large.
   */
  uploadImages(
    files: ReadonlyArray<{ buffer: Buffer; mimeType: string; originalName: string }>,
    folder: string
  ): Promise<StoredObject[]>
}

export const IMAGE_UPLOADER = Symbol('ImageUploader')
