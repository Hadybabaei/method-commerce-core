import { Module } from '@nestjs/common'
import { IdentityModule } from '@modules/identity/identity.module'
import { STORE_SETTINGS } from './application/store-settings.port'
import {
  GetStoreSettingsUseCase,
  UpdateStoreSettingsUseCase,
} from './application/store-settings.use-cases'
import { PrismaStoreSettingsRepository } from './infrastructure/prisma-store-settings.repository'
import { AdminStoreSettingsController } from './presentation/admin-store-settings.controller'

/**
 * Store-wide settings: VAT rate, return window and the seller details on
 * invoices. Ordering reads them through STORE_SETTINGS.
 */
@Module({
  imports: [IdentityModule],
  controllers: [AdminStoreSettingsController],
  providers: [
    { provide: STORE_SETTINGS, useClass: PrismaStoreSettingsRepository },
    GetStoreSettingsUseCase,
    UpdateStoreSettingsUseCase,
  ],
  exports: [STORE_SETTINGS],
})
export class StoreModule {}
