import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { IMAGE_UPLOADER, ImageUploader } from '@shared/application/ports/image-uploader.port'
import { InvalidInputError } from '@shared/domain/errors'

export const CATALOG_UPLOAD_FOLDERS = ['products', 'categories', 'brands', 'variants'] as const
export type CatalogUploadFolder = (typeof CATALOG_UPLOAD_FOLDERS)[number]

export type UploadCatalogImageCommand = {
  folder: string
  file: { buffer: Buffer; mimeType: string; originalName: string }
}

export type UploadedImageView = { url: string }

@Injectable()
export class UploadCatalogImageUseCase implements UseCase<
  UploadCatalogImageCommand,
  UploadedImageView
> {
  constructor(@Inject(IMAGE_UPLOADER) private readonly images: ImageUploader) {}

  async execute(command: UploadCatalogImageCommand): Promise<UploadedImageView> {
    if (!CATALOG_UPLOAD_FOLDERS.includes(command.folder as CatalogUploadFolder)) {
      throw new InvalidInputError('folder must be products, categories, brands or variants', {
        folder: command.folder,
      })
    }

    const [stored] = await this.images.uploadImages([command.file], command.folder)
    if (!stored) {
      throw new InvalidInputError('An image file is required')
    }

    return { url: stored.publicUrl }
  }
}
