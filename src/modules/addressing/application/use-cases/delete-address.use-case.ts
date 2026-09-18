import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { AddressNotFoundError } from '../../domain/errors/addressing.errors'
import { ADDRESS_REPOSITORY, AddressRepository } from '../../domain/repositories/address.repository'
import { AddressScopedCommand } from '../dto/commands'

@Injectable()
export class DeleteAddressUseCase implements UseCase<AddressScopedCommand, void> {
  constructor(@Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository) {}

  async execute({ addressId, userId }: AddressScopedCommand): Promise<void> {
    const address = await this.addresses.findById(addressId)

    if (!address) {
      throw new AddressNotFoundError(addressId)
    }

    address.ensureOwnedBy(userId)

    await this.addresses.delete(address.id)
  }
}
