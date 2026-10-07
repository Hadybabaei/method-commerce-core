import { DeleteObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { ConfigService } from '@nestjs/config'
import { InvalidInputError } from '@shared/domain/errors'
import { SecureRandom } from '@shared/application/ports/secure-random.port'
import { objectKey } from './object-key'
import { S3ObjectStorage } from './s3-object-storage'

const random = { alphanumeric: () => 'abc123def456' } as unknown as SecureRandom

function storage(overrides: Record<string, unknown> = {}) {
  const config = {
    getOrThrow: () => ({
      s3: {
        endpoint: 'http://localhost:9000',
        region: 'us-east-1',
        bucket: 'shop',
        accessKeyId: 'key',
        secretAccessKey: 'secret',
        forcePathStyle: true,
        objectAcl: undefined,
        publicBaseUrl: 'https://cdn.example.com',
        ...overrides,
      },
    }),
  } as unknown as ConfigService
  return new S3ObjectStorage(config, random)
}

describe('objectKey', () => {
  it('builds a unique, folder-scoped key with the extension for the MIME type', () => {
    expect(
      objectKey({ folder: '/products/', mimeType: 'image/webp', originalName: 'x.png' }, random, 42)
    ).toBe('products/42-abc123def456.webp')
    expect(
      objectKey({ folder: 'a\\b', mimeType: 'image/jpeg', originalName: 'x' }, random, 1)
    ).toBe('a/b/1-abc123def456.jpg')
  })

  it('needs an extension from the MIME type or the file name', () => {
    expect(() =>
      objectKey(
        { folder: 'x', mimeType: 'application/octet-stream', originalName: 'noext' },
        random
      )
    ).toThrow(InvalidInputError)
  })
})

describe('S3ObjectStorage', () => {
  const send = jest.spyOn(S3Client.prototype, 'send')

  beforeEach(() => send.mockReset().mockResolvedValue({} as never))

  it('uploads with the content type and a long cache lifetime, and returns the CDN URL', async () => {
    const stored = await storage({ objectAcl: 'public-read' }).store({
      buffer: Buffer.from('img'),
      mimeType: 'image/webp',
      folder: 'محصولات',
      originalName: 'x.webp',
    })

    const command = send.mock.calls[0][0] as PutObjectCommand
    expect(command).toBeInstanceOf(PutObjectCommand)
    expect(command.input).toMatchObject({
      Bucket: 'shop',
      Key: stored.relativePath,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
      ACL: 'public-read',
    })
    expect(stored.relativePath).toMatch(/^محصولات\/\d+-abc123def456\.webp$/)
    expect(stored.publicUrl).toBe(
      `https://cdn.example.com/${encodeURIComponent('محصولات')}/${stored.relativePath.split('/')[1]}`
    )
  })

  it('sends no ACL unless one is configured', async () => {
    await storage().store({
      buffer: Buffer.from('img'),
      mimeType: 'image/png',
      folder: 'brands',
      originalName: 'x.png',
    })
    expect((send.mock.calls[0][0] as PutObjectCommand).input.ACL).toBeUndefined()
  })

  it('deletes by key', async () => {
    await storage().delete('brands/1-x.webp')

    const command = send.mock.calls[0][0] as DeleteObjectCommand
    expect(command).toBeInstanceOf(DeleteObjectCommand)
    expect(command.input).toEqual({ Bucket: 'shop', Key: 'brands/1-x.webp' })
  })

  it('surfaces provider errors', async () => {
    send.mockRejectedValueOnce(new Error('AccessDenied') as never)
    await expect(
      storage().store({
        buffer: Buffer.from('i'),
        mimeType: 'image/png',
        folder: 'x',
        originalName: 'x',
      })
    ).rejects.toThrow('AccessDenied')
  })
})
