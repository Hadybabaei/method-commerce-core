import { createWriteStream } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { Readable } from 'node:stream'
import { Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { AppConfig } from '@config/app.config'
import { UploadConfig } from '@config/upload.config'
import {
  ObjectStorage,
  StoreObjectInput,
  StoredObject,
} from '@shared/application/ports/object-storage.port'
import { SECURE_RANDOM, SecureRandom } from '@shared/application/ports/secure-random.port'
import { Inject } from '@nestjs/common'
import { objectKey } from './object-key'

/**
 * Writes files under `UPLOAD_DIR` and exposes them at `SERVER_URL` + publicPath.
 */
@Injectable()
export class LocalDiskObjectStorage implements ObjectStorage {
  private readonly rootDir: string
  private readonly publicPath: string
  private readonly serverUrl: string

  constructor(
    configService: ConfigService,
    @Inject(SECURE_RANDOM) private readonly random: SecureRandom
  ) {
    const upload = configService.getOrThrow<UploadConfig>('upload')
    const app = configService.getOrThrow<AppConfig>('app')

    this.rootDir = join(process.cwd(), upload.rootDir)
    this.publicPath = upload.publicPath.replace(/\/$/, '')
    this.serverUrl = app.serverUrl.replace(/\/$/, '')
  }

  async store(input: StoreObjectInput): Promise<StoredObject> {
    const relativePath = objectKey(input, this.random)
    const absolutePath = join(this.rootDir, relativePath)
    const absoluteDir = dirname(absolutePath)

    await mkdir(absoluteDir, { recursive: true })
    await pipeline(Readable.from(input.buffer), createWriteStream(absolutePath))

    return {
      relativePath,
      publicUrl: `${this.serverUrl}${this.publicPath}/${relativePath}`,
    }
  }

  async delete(relativePath: string): Promise<void> {
    const absolutePath = join(this.rootDir, relativePath)
    try {
      await unlink(absolutePath)
    } catch (error) {
      // Already gone is fine — comment deletion should not fail on a missing file.
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
}
