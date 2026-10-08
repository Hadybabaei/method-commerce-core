import { StoreSettings } from '../domain/store-settings'

export interface StoreSettingsRepository {
  get(): Promise<StoreSettings>
  save(settings: StoreSettings): Promise<StoreSettings>
}

/** Other modules read settings (VAT rate, seller details) through this token. */
export const STORE_SETTINGS = Symbol('StoreSettingsRepository')
