import sharp from 'sharp'
import { InvalidInputError } from '@shared/domain/errors'
import { optimizeImage } from './image-optimizer'

const options = { maxDimension: 1600, quality: 82 }

function png(width: number, height: number): Promise<Buffer> {
  return sharp({ create: { width, height, channels: 3, background: '#c33' } })
    .png()
    .toBuffer()
}

describe('optimizeImage', () => {
  it('re-encodes as WebP and scales the longest side down to the limit', async () => {
    const result = await optimizeImage(
      { buffer: await png(3200, 1600), mimeType: 'image/png', originalName: 'drill.photo.PNG' },
      options
    )

    const meta = await sharp(result.buffer).metadata()
    expect(result.mimeType).toBe('image/webp')
    expect(result.originalName).toBe('drill.photo.webp')
    expect(meta.format).toBe('webp')
    expect([meta.width, meta.height]).toEqual([1600, 800])
  })

  it('never enlarges a small image', async () => {
    const result = await optimizeImage(
      { buffer: await png(400, 300), mimeType: 'image/png', originalName: 'small' },
      options
    )

    const meta = await sharp(result.buffer).metadata()
    expect([meta.width, meta.height]).toEqual([400, 300])
    expect(result.originalName).toBe('small.webp')
  })

  it('applies the EXIF rotation and drops the EXIF block', async () => {
    // Orientation 6 = the camera was turned 90°, so 400×200 pixels display as 200×400.
    const rotated = await sharp({
      create: { width: 400, height: 200, channels: 3, background: '#39c' },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()

    const result = await optimizeImage(
      { buffer: rotated, mimeType: 'image/jpeg', originalName: 'phone.jpg' },
      options
    )

    const meta = await sharp(result.buffer).metadata()
    expect([meta.width, meta.height]).toEqual([200, 400])
    expect(meta.exif).toBeUndefined()
  })

  it('leaves GIFs alone so animations survive', async () => {
    const gif = { buffer: Buffer.from('GIF89a'), mimeType: 'image/gif', originalName: 'a.gif' }
    await expect(optimizeImage(gif, options)).resolves.toBe(gif)
  })

  it('rejects bytes that are not an image', async () => {
    await expect(
      optimizeImage(
        { buffer: Buffer.from('not an image'), mimeType: 'image/jpeg', originalName: 'x.jpg' },
        options
      )
    ).rejects.toBeInstanceOf(InvalidInputError)
  })
})
