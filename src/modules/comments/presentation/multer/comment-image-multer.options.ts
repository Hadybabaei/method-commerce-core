import { memoryStorage } from 'multer'
import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface'
import { UploadConfig } from '@config/upload.config'

/**
 * Shared multer options for comment image uploads. Files stay in memory so the
 * ImageUploader can validate and write them through the storage port.
 */
export function commentImageMulterOptions(configService: ConfigService): MulterOptions {
  const upload = configService.getOrThrow<UploadConfig>('upload')

  return {
    storage: memoryStorage(),
    limits: {
      fileSize: upload.maxImageBytes,
      files: upload.maxImagesPerComment,
    },
    fileFilter: (_req, file, callback) => {
      if (!(upload.allowedImageMimeTypes as readonly string[]).includes(file.mimetype)) {
        callback(
          new BadRequestException('Only JPEG, PNG, WebP and GIF images are allowed') as Error,
          false
        )
        return
      }
      callback(null, true)
    },
  }
}
