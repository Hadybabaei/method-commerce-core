import { Injectable } from '@nestjs/common'
import { store_setting } from '@prisma/client'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { StoreSettingsRepository } from '../application/store-settings.port'
import { StoreSettings } from '../domain/store-settings'

/** The table holds a single row; it is created with defaults on first read if missing. */
const ROW_ID = 1

@Injectable()
export class PrismaStoreSettingsRepository implements StoreSettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(): Promise<StoreSettings> {
    const record = await this.prisma.store_setting.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID },
      update: {},
    })
    return toDomain(record)
  }

  async save(settings: StoreSettings): Promise<StoreSettings> {
    const data = {
      vat_rate_bp: settings.vatRateBp,
      return_window_days: settings.returnWindowDays,
      legal_name: settings.seller.legalName,
      economic_code: settings.seller.economicCode,
      national_id: settings.seller.nationalId,
      registration_no: settings.seller.registrationNo,
      address: settings.seller.address,
      postal_code: settings.seller.postalCode,
      phone: settings.seller.phone,
    }
    const record = await this.prisma.store_setting.upsert({
      where: { id: ROW_ID },
      create: { id: ROW_ID, ...data },
      update: data,
    })
    return toDomain(record)
  }
}

function toDomain(record: store_setting): StoreSettings {
  return {
    vatRateBp: record.vat_rate_bp,
    returnWindowDays: record.return_window_days,
    seller: {
      legalName: record.legal_name,
      economicCode: record.economic_code,
      nationalId: record.national_id,
      registrationNo: record.registration_no,
      address: record.address,
      postalCode: record.postal_code,
      phone: record.phone,
    },
  }
}
