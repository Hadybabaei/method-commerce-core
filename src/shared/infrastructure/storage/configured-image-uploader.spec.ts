import sharp from 'sharp'
import { ConfigService } from '@nestjs/config'
import { InvalidInputError } from '@shared/domain/errors'
import { ObjectStorage, StoreObjectInput } from '@shared/application/ports/object-storage.port'
import { ConfiguredImageUploader } from './configured-image-uploader'

const upload = {
  maxImageBytes: 1024 * 1024,
  maxImagesPerComment: 2,
  maxImageDimension: 100,
  webpQuality: 80,
  allowedImageMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}

function setup() {
  const stored: StoreObjectInput[] = []
  const storage: jest.Mocked<ObjectStorage> = {
    store: jest.fn(async (input) => {
      stored.push(input)
      return { relativePath: `${input.folder}/${stored.length}`, publicUrl: `u/${stored.length}` }
    }),
    delete: jest.fn(async (_relativePath: string) => undefined),
  }
  const config = { getOrThrow: () => upload } as unknown as ConfigService
  return { stored, storage, uploader: new ConfiguredImageUploader(config, storage) }
}

const png = (size: number) =>
  sharp({ create: { width: size, height: size, channels: 3, background: '#fff' } })
    .png()
    .toBuffer()

describe('ConfiguredImageUploader', () => {
  it('stores an optimised WebP instead of the original bytes', async () => {
    const { stored, uploader } = setup()

    const result = await uploader.uploadImages(
      [{ buffer: await png(500), mimeType: 'image/png', originalName: 'big.png' }],
      'products'
    )

    expect(result).toEqual([{ relativePath: 'products/1', publicUrl: 'u/1' }])
    expect(stored[0]).toMatchObject({
      mimeType: 'image/webp',
      folder: 'products',
      originalName: 'big.webp',
    })
    expect((await sharp(stored[0].buffer).metadata()).width).toBe(100)
  })

  it('rejects disallowed types before storing anything', async () => {
    const { storage, uploader } = setup()

    await expect(
      uploader.uploadImages(
        [{ buffer: Buffer.from('x'), mimeType: 'image/svg+xml', originalName: 'x.svg' }],
        'products'
      )
    ).rejects.toBeInstanceOf(InvalidInputError)
    expect(storage.store).not.toHaveBeenCalled()
  })

  it('removes already stored files when a later file in the batch fails', async () => {
    const { storage, uploader } = setup()

    await expect(
      uploader.uploadImages(
        [
          { buffer: await png(10), mimeType: 'image/png', originalName: 'ok.png' },
          { buffer: Buffer.from('broken'), mimeType: 'image/jpeg', originalName: 'bad.jpg' },
        ],
        'comments'
      )
    ).rejects.toBeInstanceOf(InvalidInputError)
    expect(storage.delete).toHaveBeenCalledWith('comments/1')
  })
})
