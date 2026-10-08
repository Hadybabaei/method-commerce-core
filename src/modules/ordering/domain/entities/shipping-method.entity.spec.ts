import { Money } from '@shared/domain/value-objects/money'
import { InvalidShippingMethodError } from '../errors/ordering.errors'
import { ShippingMethod } from './shipping-method.entity'

describe('ShippingMethod', () => {
  const post = () =>
    ShippingMethod.create({
      name: ' Post ',
      code: 'POST',
      baseFee: 500_000,
      perKgFee: 100_000,
      freeAbove: 10_000_000,
    })

  it('normalises name and code', () => {
    const method = post()
    expect(method.name).toBe('Post')
    expect(method.code).toBe('post')
    expect(method.isActive).toBe(true)
  })

  it.each([
    [0, 600_000],
    [1, 600_000],
    [1000, 600_000],
    [1001, 700_000],
    [5500, 1_100_000],
  ])('charges base + per started kg (%i g → %i)', (weightGrams, fee) => {
    expect(post().quote({ weightGrams, subtotal: Money.fromMinor(1) }).amount).toBe(fee)
  })

  it('is free at or above free_above', () => {
    const method = post()
    expect(method.quote({ weightGrams: 9000, subtotal: Money.fromMinor(10_000_000) }).isZero).toBe(
      true
    )
    expect(method.quote({ weightGrams: 9000, subtotal: Money.fromMinor(9_999_999) }).isZero).toBe(
      false
    )
  })

  it('serves every province unless restricted', () => {
    expect(post().servesProvince(31)).toBe(true)

    const tehran = ShippingMethod.create({
      name: 'T',
      code: 't',
      baseFee: 0,
      provinceIds: [8, 1, 1],
    })
    expect(tehran.provinceIds).toEqual([1, 8])
    expect(tehran.servesProvince(1)).toBe(true)
    expect(tehran.servesProvince(2)).toBe(false)
  })

  it('keeps unspecified fields on update', () => {
    const method = post()
    method.update({ baseFee: 700_000, freeAbove: null })
    expect(method.baseFee.amount).toBe(700_000)
    expect(method.perKgFee.amount).toBe(100_000)
    expect(method.freeAbove).toBeNull()
  })

  it.each([
    [{ code: 'has space' }],
    [{ name: '' }],
    [{ minDays: 5, maxDays: 2 }],
    [{ provinceIds: [] }],
    [{ trackingUrlTemplate: 'https://example.com/track' }],
    [{ trackingUrlTemplate: 'ftp://example.com/{code}' }],
  ])('rejects invalid input %p', (override) => {
    expect(() =>
      ShippingMethod.create({ name: 'Post', code: 'post', baseFee: 1, ...override })
    ).toThrow(InvalidShippingMethodError)
  })
})
