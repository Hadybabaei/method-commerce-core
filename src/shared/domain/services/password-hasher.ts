/**
 * Hashing is a domain concern (aggregates decide when a password is replaced or
 * compared) but the algorithm is not, so the domain only depends on this port.
 */
export interface PasswordHasher {
  hash(plainPassword: string): Promise<string>
  compare(plainPassword: string, hash: string): Promise<boolean>
}

export const PASSWORD_HASHER = Symbol('PasswordHasher')
