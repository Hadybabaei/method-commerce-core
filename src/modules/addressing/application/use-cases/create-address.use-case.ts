import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Address } from '../../domain/entities/address.aggregate'
import { AddressNotFoundError } from '../../domain/errors/addressing.errors'
import { ADDRESS_REPOSITORY, AddressRepository } from '../../domain/repositories/address.repository'
import {
  LOCATION_REPOSITORY,
  LocationRepository,
} from '../../domain/repositories/location.repository'
import { resolveVerifiedLocation } from '../../domain/services/location-validator'
import { GeoPoint } from '../../domain/value-objects/geo-point.vo'
import { PostalCode } from '../../domain/value-objects/postal-code.vo'
import { Receiver } from '../../domain/value-objects/receiver.vo'
import { CreateAddressCommand } from '../dto/commands'
import { AddressView } from '../dto/views'
import { ADDRESS_READ_MODEL, AddressReadModel } from '../ports/address-read.port'

@Injectable()
export class CreateAddressUseCase implements UseCase<CreateAddressCommand, AddressView> {
  constructor(
    @Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository,
    @Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel,
    @Inject(LOCATION_REPOSITORY) private readonly locations: LocationRepository
  ) {}

  async execute(command: CreateAddressCommand): Promise<AddressView> {
    const { cityId, provinceId } = await resolveVerifiedLocation(
      this.locations,
      command.cityId,
      command.provinceId
    )

    const address = Address.create({
      userId: command.userId,
      title: command.title,
      provinceId,
      cityId,
      hood: command.hood,
      postalCode: PostalCode.create(command.postalCode),
      pelak: command.pelak,
      vahed: command.vahed ?? null,
      details: command.details,
      receiver: command.ownReceiver
        ? Receiver.accountOwner()
        : Receiver.thirdParty(command.receiverFullName ?? '', command.receiverPhoneNumber ?? ''),
      location: GeoPoint.createOptional(command.latitude, command.longitude),
    })

    const saved = await this.addresses.save(address)
    const view = await this.addressReads.findById(saved.id)

    if (!view) {
      throw new AddressNotFoundError(saved.id)
    }

    return view
  }
}
