import { User } from '../entities/user.aggregate'
import { PhoneNumber } from '../value-objects/phone-number.vo'

export interface UserRepository {
  findById(id: number): Promise<User | null>

  findByPhoneNumber(phoneNumber: PhoneNumber): Promise<User | null>

  /** Inserts when the aggregate is new, updates otherwise. */
  save(user: User): Promise<User>

  existsByPhoneNumber(phoneNumber: PhoneNumber): Promise<boolean>
}

export const USER_REPOSITORY = Symbol('UserRepository')
