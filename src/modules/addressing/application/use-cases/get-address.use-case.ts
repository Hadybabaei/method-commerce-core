import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { AddressNotFoundError } from '../../domain/errors/addressing.errors'
import { ADDRESS_REPOSITORY, AddressRepository } from '../../domain/repositories/address.repository'
import { AddressScopedCommand } from '../dto/commands'
import { AddressView } from '../dto/views'
import { ADDRESS_READ_MODEL, AddressReadModel } from '../ports/address-read.port'

@Injectable()
export class GetAddressUseCase implements UseCase<AddressScopedCommand, AddressView> {
  constructor(
    @Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository,
    @Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel
  ) {}

  async execute({ addressId, userId }: AddressScopedCommand): Promise<AddressView> {
    // Ownership is a domain rule, so it is checked on the aggregate rather than
    // by filtering the query.
    const address = await this.addresses.findById(addressId)

    if (!address) {
      throw new AddressNotFoundError(addressId)
    }

    address.ensureOwnedBy(userId)

    const view = await this.addressReads.findById(addressId)

    if (!view) {
      throw new AddressNotFoundError(addressId)
    }

    return view
  }
}
