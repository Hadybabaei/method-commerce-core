import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { AddressChanges } from '../../domain/entities/address.aggregate'
import { AddressNotFoundError } from '../../domain/errors/addressing.errors'
import { ADDRESS_REPOSITORY, AddressRepository } from '../../domain/repositories/address.repository'
import {
  LOCATION_REPOSITORY,
  LocationRepository,
} from '../../domain/repositories/location.repository'
import { resolveVerifiedLocation } from '../../domain/services/location-validator'
import { GeoPoint } from '../../domain/value-objects/geo-point.vo'
import { PostalCode } from '../../domain/value-objects/postal-code.vo'
import { UpdateAddressCommand } from '../dto/commands'
import { AddressView } from '../dto/views'
import { toReceiver } from '../mappers/receiver.mapper'
import { ADDRESS_READ_MODEL, AddressReadModel } from '../ports/address-read.port'

@Injectable()
export class UpdateAddressUseCase implements UseCase<UpdateAddressCommand, AddressView> {
  constructor(
    @Inject(ADDRESS_REPOSITORY) private readonly addresses: AddressRepository,
    @Inject(ADDRESS_READ_MODEL) private readonly addressReads: AddressReadModel,
    @Inject(LOCATION_REPOSITORY) private readonly locations: LocationRepository
  ) {}

  async execute(command: UpdateAddressCommand): Promise<AddressView> {
    const address = await this.addresses.findById(command.addressId)

    if (!address) {
      throw new AddressNotFoundError(command.addressId)
    }

    address.ensureOwnedBy(command.userId)
    address.apply(await this.toChanges(command))

    const saved = await this.addresses.save(address)
    const view = await this.addressReads.findById(saved.id)

    if (!view) {
      throw new AddressNotFoundError(saved.id)
    }

    return view
  }

  private async toChanges(command: UpdateAddressCommand): Promise<AddressChanges> {
    const changes: AddressChanges = {}

    if (command.title !== undefined) changes.title = command.title
    if (command.hood !== undefined) changes.hood = command.hood
    if (command.pelak !== undefined) changes.pelak = command.pelak
    if (command.vahed !== undefined) changes.vahed = command.vahed
    if (command.details !== undefined) changes.details = command.details
    if (command.postalCode !== undefined) {
      changes.postalCode = PostalCode.create(command.postalCode)
    }

    // Latitude and longitude only mean something together, so the pin is
    // rebuilt whenever either one is sent.
    if (command.latitude !== undefined || command.longitude !== undefined) {
      changes.location = GeoPoint.createOptional(command.latitude, command.longitude)
    }

    const receiver = toReceiver(
      command.ownReceiver,
      command.receiverFullName,
      command.receiverPhoneNumber
    )
    if (receiver) changes.receiver = receiver

    if (command.cityId !== undefined) {
      const location = await resolveVerifiedLocation(
        this.locations,
        command.cityId,
        command.provinceId
      )
      changes.cityId = location.cityId
      changes.provinceId = location.provinceId
    }

    return changes
  }
}
