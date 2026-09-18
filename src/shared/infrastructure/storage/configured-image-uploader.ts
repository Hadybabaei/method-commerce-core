import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { UploadConfig } from '@config/upload.config'
import { InvalidInputError } from '@shared/domain/errors'
import { ImageUploader } from '@shared/application/ports/image-uploader.port'
import {
  OBJECT_STORAGE,
  ObjectStorage,
  StoredObject,
} from '@shared/application/ports/object-storage.port'

@Injectable()
export class ConfiguredImageUploader implements ImageUploader {
  private readonly maxBytes: number
  private readonly maxCount: number
  private readonly allowedMimeTypes: ReadonlySet<string>

  constructor(
    configService: ConfigService,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStorage
  ) {
    const upload = configService.getOrThrow<UploadConfig>('upload')
    this.maxBytes = upload.maxImageBytes
    this.maxCount = upload.maxImagesPerComment
    this.allowedMimeTypes = new Set(upload.allowedImageMimeTypes)
  }

  async uploadImages(
    files: ReadonlyArray<{ buffer: Buffer; mimeType: string; originalName: string }>,
    folder: string
  ): Promise<StoredObject[]> {
    if (files.length === 0) {
      return []
    }

    if (files.length > this.maxCount) {
      throw new InvalidInputError(`At most ${this.maxCount} images are allowed`, {
        max: this.maxCount,
      })
    }

    for (const file of files) {
      if (!this.allowedMimeTypes.has(file.mimeType)) {
        throw new InvalidInputError('Only JPEG, PNG, WebP and GIF images are allowed', {
          mimeType: file.mimeType,
        })
      }
      if (file.buffer.byteLength === 0) {
        throw new InvalidInputError('An uploaded image was empty')
      }
      if (file.buffer.byteLength > this.maxBytes) {
        throw new InvalidInputError(`Each image must be at most ${this.maxBytes} bytes`, {
          maxBytes: this.maxBytes,
        })
      }
    }

    const stored: StoredObject[] = []
    try {
      for (const file of files) {
        stored.push(
          await this.storage.store({
            buffer: file.buffer,
            mimeType: file.mimeType,
            folder,
            originalName: file.originalName,
          })
        )
      }
    } catch (error) {
      // Roll back anything already written so a failed batch leaves no orphans.
      await Promise.all(stored.map((object) => this.storage.delete(object.relativePath)))
      throw error
    }

    return stored
  }
}
