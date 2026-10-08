import { memoryStorage } from 'multer'
import { BadRequestException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface'
import { UploadConfig } from '@config/upload.config'

export function catalogImageMulterOptions(configService: ConfigService): MulterOptions {
  const upload = configService.getOrThrow<UploadConfig>('upload')

  return {
    storage: memoryStorage(),
    limits: {
      fileSize: upload.maxImageBytes,
      files: 1,
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
