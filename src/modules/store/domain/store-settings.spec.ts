import { InvalidInputError } from '@shared/domain/errors'
import { StoreSettings, applyStoreSettings, vatOn } from './store-settings'

const base: StoreSettings = {
  vatRateBp: 1000,
  returnWindowDays: 7,
  seller: {
    legalName: null,
    economicCode: null,
    nationalId: null,
    registrationNo: null,
    address: null,
    postalCode: null,
    phone: null,
  },
}

describe('store settings', () => {
  it('rounds VAT to the nearest Rial', () => {
    expect(vatOn(2_000_000, 1000)).toBe(200_000)
    expect(vatOn(15, 1000)).toBe(2) // 1.5 rounds up
    expect(vatOn(14, 1000)).toBe(1)
    expect(vatOn(999, 0)).toBe(0)
  })

  it('changes only the sent fields and trims seller details', () => {
    const next = applyStoreSettings(base, {
      vatRateBp: 900,
      seller: { legalName: '  شرکت متد  ', address: '   ' },
    })
    expect(next.vatRateBp).toBe(900)
    expect(next.returnWindowDays).toBe(7)
    expect(next.seller.legalName).toBe('شرکت متد')
    expect(next.seller.address).toBeNull()
  })

  it.each([
    [{ vatRateBp: -1 }],
    [{ vatRateBp: 10_001 }],
    [{ vatRateBp: 9.5 }],
    [{ returnWindowDays: 366 }],
    [{ seller: { postalCode: '12345' } }],
    [{ seller: { economicCode: '41-1111' } }],
  ])('rejects %p', (changes) => {
    expect(() => applyStoreSettings(base, changes)).toThrow(InvalidInputError)
  })
})
