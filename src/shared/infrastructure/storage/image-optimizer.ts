import sharp from 'sharp'
import { InvalidInputError } from '@shared/domain/errors'

export interface ImageFile {
  buffer: Buffer
  mimeType: string
  originalName: string
}

export interface ImageOptimizerOptions {
  /** Longest side in pixels; larger images are scaled down, smaller ones are left alone. */
  maxDimension: number
  /** WebP quality, 1–100. */
  quality: number
}

/**
 * Re-encodes a still image as WebP: applies the EXIF rotation, strips metadata
 * (including GPS) and caps the size. GIFs pass through so animations survive.
 */
export async function optimizeImage(
  file: ImageFile,
  options: ImageOptimizerOptions
): Promise<ImageFile> {
  if (file.mimeType === 'image/gif') {
    return file
  }

  let buffer: Buffer
  try {
    buffer = await sharp(file.buffer)
      .rotate()
      .resize({
        width: options.maxDimension,
        height: options.maxDimension,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: options.quality })
      .toBuffer()
  } catch {
    throw new InvalidInputError('The file is not a readable image', { name: file.originalName })
  }

  return {
    buffer,
    mimeType: 'image/webp',
    originalName: file.originalName.replace(/\.[^./\\]*$/, '') + '.webp',
  }
}
