import { extname } from 'node:path'
import { InvalidInputError } from '@shared/domain/errors'
import { StoreObjectInput } from '@shared/application/ports/object-storage.port'
import { SecureRandom } from '@shared/application/ports/secure-random.port'

const EXTENSION_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

/** `folder/1710000000000-a1b2c3d4e5f6.webp`: unique, so it can be cached forever. */
export function objectKey(
  input: Pick<StoreObjectInput, 'folder' | 'mimeType' | 'originalName'>,
  random: SecureRandom,
  now = Date.now()
): string {
  const extension = EXTENSION_BY_MIME[input.mimeType] ?? extname(input.originalName).toLowerCase()

  if (!extension) {
    throw new InvalidInputError('Could not determine a file extension for the upload')
  }

  const folder = input.folder.replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return `${folder}/${now}-${random.alphanumeric(12)}${extension}`
}
