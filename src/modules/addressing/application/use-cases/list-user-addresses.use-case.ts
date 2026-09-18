import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { AddressView } from '../dto/views'
import { ADDRESS_READ_MODEL, AddressReadModel } from '../ports/address-read.port'

@Injectable()
export class ListUserAddressesUseCase implements UseCase<number, AddressView[]> {
  constructor(@Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel) {}

  execute(userId: number): Promise<AddressView[]> {
    return this.addressReads.listByUserId(userId)
  }
}
