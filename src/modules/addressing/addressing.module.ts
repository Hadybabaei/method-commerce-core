import { Module } from '@nestjs/common'
import { IdentityModule } from '@modules/identity/identity.module'
import { ADDRESS_READ_MODEL } from './application/ports/address-read.port'
import { CreateAddressUseCase } from './application/use-cases/create-address.use-case'
import { DeleteAddressUseCase } from './application/use-cases/delete-address.use-case'
import { GetAddressUseCase } from './application/use-cases/get-address.use-case'
import {
  ListCitiesUseCase,
  ListProvincesUseCase,
} from './application/use-cases/list-locations.use-case'
import { ListUserAddressesUseCase } from './application/use-cases/list-user-addresses.use-case'
import { UpdateAddressUseCase } from './application/use-cases/update-address.use-case'
import { ADDRESS_REPOSITORY } from './domain/repositories/address.repository'
import { LOCATION_REPOSITORY } from './domain/repositories/location.repository'
import { PrismaAddressReadModel } from './infrastructure/persistence/prisma-address-read.model'
import { PrismaAddressRepository } from './infrastructure/persistence/prisma-address.repository'
import { PrismaLocationRepository } from './infrastructure/persistence/prisma-location.repository'
import { AddressesController } from './presentation/controllers/addresses.controller'
import { LocationsController } from './presentation/controllers/locations.controller'

/**
 * Addressing bounded context: delivery addresses plus the province/city
 * reference data they point at. Imports `IdentityModule` only to reuse its
 * authentication guard.
 */
@Module({
  imports: [IdentityModule],
  controllers: [AddressesController, LocationsController],
  providers: [
    { provide: ADDRESS_REPOSITORY, useClass: PrismaAddressRepository },
    { provide: ADDRESS_READ_MODEL, useClass: PrismaAddressReadModel },
    { provide: LOCATION_REPOSITORY, useClass: PrismaLocationRepository },
    CreateAddressUseCase,
    UpdateAddressUseCase,
    DeleteAddressUseCase,
    GetAddressUseCase,
    ListUserAddressesUseCase,
    ListProvincesUseCase,
    ListCitiesUseCase,
  ],
  // Orders (and later shipping) need to resolve a customer's address without
  // reaching into addressing persistence themselves.
  exports: [ADDRESS_REPOSITORY, ADDRESS_READ_MODEL, GetAddressUseCase],
})
export class AddressingModule {}
