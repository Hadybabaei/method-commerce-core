export interface SecureRandom {
  /** Cryptographically random alphanumeric string, used for reset tokens. */
  alphanumeric(length: number): string
  /** Cryptographically random decimal digits. */
  digits(length: number): string
}

export const SECURE_RANDOM = Symbol('SecureRandom')
