import { AddressView } from '../dto/views'

/**
 * Read side of the addressing context. Kept separate from `AddressRepository`
 * because reads need province and city names joined in, which the aggregate has
 * no business holding.
 */
export interface AddressReadModel {
  findById(addressId: number): Promise<AddressView | null>

  listByUserId(userId: number): Promise<AddressView[]>
}

export const ADDRESS_READ_MODEL = Symbol('AddressReadModel')
