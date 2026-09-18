import { registerAs } from '@nestjs/config'
import { toInt } from './parsers'

export const uploadConfig = registerAs('upload', () => ({
  /** Absolute or cwd-relative folder where files land on disk. */
  rootDir: process.env.UPLOAD_DIR ?? 'uploads',
  /** URL path prefix that maps to `rootDir` (no trailing slash). */
  publicPath: process.env.UPLOAD_PUBLIC_PATH ?? '/uploads',
  maxImageBytes: toInt(process.env.UPLOAD_MAX_IMAGE_BYTES, 5 * 1024 * 1024),
  maxImagesPerComment: toInt(process.env.UPLOAD_MAX_IMAGES_PER_COMMENT, 5),
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const,
}))

export type UploadConfig = ReturnType<typeof uploadConfig>
