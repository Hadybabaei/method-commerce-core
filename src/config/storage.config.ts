import { registerAs } from '@nestjs/config'
import { StorageDriver } from './env.validation'
import { toBool } from './parsers'

export const storageConfig = registerAs('storage', () => ({
  driver: (process.env.STORAGE_DRIVER as StorageDriver) || StorageDriver.Disk,
  s3: {
    /** Empty for AWS; e.g. https://s3.ir-thr-at1.arvanstorage.ir or http://localhost:9000 (MinIO). */
    endpoint: process.env.S3_ENDPOINT || undefined,
    region: process.env.S3_REGION || 'us-east-1',
    bucket: process.env.S3_BUCKET ?? '',
    accessKeyId: process.env.S3_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.S3_SECRET_ACCESS_KEY ?? '',
    /** Most S3-compatible providers need path-style URLs. */
    forcePathStyle: toBool(process.env.S3_FORCE_PATH_STYLE, true),
    /** e.g. public-read when the bucket itself is private. Empty sends no ACL. */
    objectAcl: process.env.S3_OBJECT_ACL || undefined,
    /** Public URL of the bucket or the CDN in front of it; no trailing slash. */
    publicBaseUrl: (process.env.S3_PUBLIC_BASE_URL ?? '').replace(/\/+$/, ''),
  },
}))

export type StorageConfig = ReturnType<typeof storageConfig>
