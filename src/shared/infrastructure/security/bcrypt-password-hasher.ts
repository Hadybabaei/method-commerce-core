import { Injectable } from '@nestjs/common'
import { compare, hash } from 'bcryptjs'
import { PasswordHasher } from '@shared/domain/services/password-hasher'

const SALT_ROUNDS = 10

/**
 * Produces `$2b$` hashes, so hashes created by the legacy Express service
 * keep validating here.
 */
@Injectable()
export class BcryptPasswordHasher implements PasswordHasher {
  hash(plainPassword: string): Promise<string> {
    return hash(plainPassword, SALT_ROUNDS)
  }

  compare(plainPassword: string, passwordHash: string): Promise<boolean> {
    return compare(plainPassword, passwordHash)
  }
}
