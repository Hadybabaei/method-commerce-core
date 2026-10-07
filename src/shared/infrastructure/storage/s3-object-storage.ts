import {
  DeleteObjectCommand,
  ObjectCannedACL,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { StorageConfig } from '@config/storage.config'
import {
  ObjectStorage,
  StoreObjectInput,
  StoredObject,
} from '@shared/application/ports/object-storage.port'
import { SECURE_RANDOM, SecureRandom } from '@shared/application/ports/secure-random.port'
import { objectKey } from './object-key'

/** Uploaded names are unique, so browsers and the CDN may cache them forever. */
const IMMUTABLE_CACHE = 'public, max-age=31536000, immutable'

/**
 * Any S3-compatible bucket (AWS, ArvanCloud, Liara, MinIO). Files are served
 * from `S3_PUBLIC_BASE_URL`, normally a CDN in front of the bucket, so every
 * API instance shares the same images.
 */
@Injectable()
export class S3ObjectStorage implements ObjectStorage {
  private readonly config: StorageConfig['s3']
  private readonly client: S3Client

  constructor(
    configService: ConfigService,
    @Inject(SECURE_RANDOM) private readonly random: SecureRandom
  ) {
    this.config = configService.getOrThrow<StorageConfig>('storage').s3
    this.client = new S3Client({
      endpoint: this.config.endpoint,
      region: this.config.region,
      forcePathStyle: this.config.forcePathStyle,
      credentials: {
        accessKeyId: this.config.accessKeyId,
        secretAccessKey: this.config.secretAccessKey,
      },
    })
  }

  async store(input: StoreObjectInput): Promise<StoredObject> {
    const key = objectKey(input, this.random)

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: input.buffer,
        ContentType: input.mimeType,
        CacheControl: IMMUTABLE_CACHE,
        ACL: this.config.objectAcl as ObjectCannedACL | undefined,
      })
    )

    return {
      relativePath: key,
      publicUrl: `${this.config.publicBaseUrl}/${key.split('/').map(encodeURIComponent).join('/')}`,
    }
  }

  async delete(relativePath: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.config.bucket, Key: relativePath })
    )
  }
}
