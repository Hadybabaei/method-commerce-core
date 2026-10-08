import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { StoreSettings, StoreSettingsChanges, applyStoreSettings } from '../domain/store-settings'
import { STORE_SETTINGS, StoreSettingsRepository } from './store-settings.port'

@Injectable()
export class GetStoreSettingsUseCase implements UseCase<void, StoreSettings> {
  constructor(@Inject(STORE_SETTINGS) private readonly settings: StoreSettingsRepository) {}

  execute(): Promise<StoreSettings> {
    return this.settings.get()
  }
}

@Injectable()
export class UpdateStoreSettingsUseCase implements UseCase<StoreSettingsChanges, StoreSettings> {
  constructor(@Inject(STORE_SETTINGS) private readonly settings: StoreSettingsRepository) {}

  async execute(changes: StoreSettingsChanges): Promise<StoreSettings> {
    const current = await this.settings.get()
    return this.settings.save(applyStoreSettings(current, changes))
  }
}
