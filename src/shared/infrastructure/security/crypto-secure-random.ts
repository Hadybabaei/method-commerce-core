import { randomInt } from 'node:crypto'
import { Injectable } from '@nestjs/common'
import { SecureRandom } from '@shared/application/ports/secure-random.port'

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789'
const DIGITS = '0123456789'

@Injectable()
export class CryptoSecureRandom implements SecureRandom {
  alphanumeric(length: number): string {
    return this.pick(ALPHABET, length)
  }

  digits(length: number): string {
    return this.pick(DIGITS, length)
  }

  private pick(alphabet: string, length: number): string {
    let result = ''
    for (let index = 0; index < length; index += 1) {
      result += alphabet[randomInt(alphabet.length)]
    }
    return result
  }
}
