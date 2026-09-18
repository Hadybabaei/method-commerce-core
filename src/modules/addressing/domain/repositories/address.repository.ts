import { Address } from '../entities/address.aggregate'

export interface AddressRepository {
  findById(id: number): Promise<Address | null>

  findAllByUserId(userId: number): Promise<Address[]>

  countByUserId(userId: number): Promise<number>

  /** Inserts when the aggregate is new, updates otherwise. */
  save(address: Address): Promise<Address>

  delete(id: number): Promise<void>
}

export const ADDRESS_REPOSITORY = Symbol('AddressRepository')
