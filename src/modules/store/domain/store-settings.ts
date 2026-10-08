import { InvalidInputError } from '@shared/domain/errors'

/** 100% in basis points. */
export const MAX_VAT_RATE_BP = 10_000

export interface SellerDetails {
  legalName: string | null
  economicCode: string | null
  nationalId: string | null
  registrationNo: string | null
  address: string | null
  postalCode: string | null
  phone: string | null
}

export interface StoreSettings {
  /** VAT in basis points: 1000 = 10%. Added on top of catalog prices. */
  vatRateBp: number
  /** Days after delivery during which a customer may ask to return items. */
  returnWindowDays: number
  seller: SellerDetails
}

export type StoreSettingsChanges = Partial<Omit<StoreSettings, 'seller'>> & {
  seller?: Partial<SellerDetails>
}

const DIGITS = /^\d+$/

/** Applies changes and checks every field; returns the new settings. */
export function applyStoreSettings(
  current: StoreSettings,
  changes: StoreSettingsChanges
): StoreSettings {
  const next: StoreSettings = {
    vatRateBp: changes.vatRateBp ?? current.vatRateBp,
    returnWindowDays: changes.returnWindowDays ?? current.returnWindowDays,
    seller: { ...current.seller },
  }

  for (const [key, value] of Object.entries(changes.seller ?? {}) as [
    keyof SellerDetails,
    string | null | undefined,
  ][]) {
    if (value !== undefined) next.seller[key] = value?.trim() || null
  }

  if (!Number.isInteger(next.vatRateBp) || next.vatRateBp < 0 || next.vatRateBp > MAX_VAT_RATE_BP) {
    throw new InvalidInputError('VAT rate must be a whole number of basis points from 0 to 10000', {
      vatRateBp: next.vatRateBp,
    })
  }
  if (
    !Number.isInteger(next.returnWindowDays) ||
    next.returnWindowDays < 0 ||
    next.returnWindowDays > 365
  ) {
    throw new InvalidInputError('Return window must be 0 to 365 days', {
      returnWindowDays: next.returnWindowDays,
    })
  }

  const { postalCode, economicCode, nationalId } = next.seller
  if (postalCode !== null && !(DIGITS.test(postalCode) && postalCode.length === 10)) {
    throw new InvalidInputError('Postal code must be 10 digits', { postalCode })
  }
  for (const [label, value] of [
    ['Economic code', economicCode],
    ['National id', nationalId],
  ] as const) {
    if (value !== null && !DIGITS.test(value)) {
      throw new InvalidInputError(`${label} must contain digits only`, { value })
    }
  }

  return next
}

/** VAT on an amount, rounded to the nearest Rial. */
export function vatOn(amount: number, rateBp: number): number {
  return Math.round((amount * rateBp) / MAX_VAT_RATE_BP)
}
