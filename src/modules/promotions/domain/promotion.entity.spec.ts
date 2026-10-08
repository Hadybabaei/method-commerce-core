import { allocate } from './allocate'
import {
  CouponNotApplicableError,
  InvalidPromotionError,
  PricedLine,
  Promotion,
  PromotionInput,
  PromotionKind,
} from './promotion.entity'

const now = new Date('2026-10-09T12:00:00Z')
const line = (lineTotal: number, overrides: Partial<PricedLine> = {}): PricedLine => ({
  categoryId: null,
  categoryPath: null,
  brandId: null,
  lineTotal,
  ...overrides,
})
const promo = (overrides: Partial<PromotionInput> = {}) =>
  Promotion.create({
    name: 'Autumn',
    code: 'autumn10',
    kind: PromotionKind.Percent,
    value: 10,
    maxDiscount: null,
    minSubtotal: null,
    startsAt: new Date('2026-10-01T00:00:00Z'),
    endsAt: null,
    usageLimit: null,
    perCustomerLimit: null,
    categoryIds: null,
    brandIds: null,
    ...overrides,
  })

describe('allocate', () => {
  it('splits proportionally and always sums to the total', () => {
    expect(allocate(100, [1, 1, 1])).toEqual([34, 33, 33])
    expect(allocate(10, [700, 300])).toEqual([7, 3])
    expect(allocate(7, [0, 5])).toEqual([0, 7])
    expect(allocate(0, [1, 2])).toEqual([0, 0])
    const parts = allocate(999_999, [123, 4567, 89])
    expect(parts.reduce((a, b) => a + b)).toBe(999_999)
  })
})

describe('Promotion', () => {
  it('uppercases codes and validates input', () => {
    expect(promo().code).toBe('AUTUMN10')
    expect(() => promo({ code: 'x' })).toThrow(InvalidPromotionError)
    expect(() => promo({ value: 0 })).toThrow(InvalidPromotionError)
    expect(() => promo({ kind: PromotionKind.Fixed, value: -5 })).toThrow(InvalidPromotionError)
    expect(() => promo({ endsAt: new Date('2026-09-01T00:00:00Z') })).toThrow(InvalidPromotionError)
    expect(() => promo({ categoryIds: [] })).toThrow(InvalidPromotionError)
  })

  it('takes a percent of the eligible lines, capped', () => {
    expect(
      promo().evaluate({ lines: [line(1_000_000), line(500_000)], shippingFee: 0, now })
    ).toMatchObject({
      goods: 150_000,
      shipping: 0,
    })
    expect(
      promo({ maxDiscount: 100_000 }).evaluate({ lines: [line(2_000_000)], shippingFee: 0, now })
        .goods
    ).toBe(100_000)
  })

  it('never takes more than the eligible lines are worth', () => {
    const fixed = promo({ kind: PromotionKind.Fixed, value: 5_000_000 })
    expect(fixed.evaluate({ lines: [line(1_000_000)], shippingFee: 0, now }).goods).toBe(1_000_000)
  })

  it('covers a category, its sub-categories and brands', () => {
    const scoped = promo({ categoryIds: [7], brandIds: [3] })
    expect(scoped.covers(line(1, { categoryId: 7 }))).toBe(true)
    expect(scoped.covers(line(1, { categoryId: 12, categoryPath: '/1/7/' }))).toBe(true)
    expect(scoped.covers(line(1, { categoryId: 70, categoryPath: '/1/' }))).toBe(false)
    expect(scoped.covers(line(1, { brandId: 3 }))).toBe(true)

    const result = scoped.evaluate({
      lines: [line(1_000_000, { categoryId: 7 }), line(9_000_000, { categoryId: 2 })],
      shippingFee: 0,
      now,
    })
    expect(result).toMatchObject({ goods: 100_000, eligible: [true, false] })
  })

  it('gives free shipping', () => {
    const free = promo({ kind: PromotionKind.FreeShipping, value: 0 })
    expect(free.evaluate({ lines: [line(1)], shippingFee: 600_000, now })).toMatchObject({
      goods: 0,
      shipping: 600_000,
    })
    expect(() => free.evaluate({ lines: [line(1)], shippingFee: 0, now })).toThrow(
      CouponNotApplicableError
    )
  })

  it.each([
    ['not started', { startsAt: new Date('2026-11-01T00:00:00Z') }],
    [
      'ended',
      { startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-10-01T00:00:00Z') },
    ],
    ['inactive', { isActive: false }],
    ['below the minimum', { minSubtotal: 2_000_000 }],
    ['out of scope', { brandIds: [99] }],
  ])('does not apply when %s', (_, overrides) => {
    expect(() =>
      promo(overrides).evaluate({ lines: [line(1_000_000)], shippingFee: 0, now })
    ).toThrow(CouponNotApplicableError)
  })

  it('stops once the usage limit is reached', () => {
    const props = {
      name: 'Limited',
      code: 'LIMITED',
      kind: PromotionKind.Fixed,
      value: 1000,
      maxDiscount: null,
      minSubtotal: null,
      startsAt: new Date('2026-10-01T00:00:00Z'),
      endsAt: null,
      usageLimit: 2,
      perCustomerLimit: null,
      categoryIds: null,
      brandIds: null,
      isActive: true,
    }
    expect(Promotion.fromPersistence(1, { ...props, usedCount: 1 }).isLive(now)).toBe(true)
    expect(Promotion.fromPersistence(1, { ...props, usedCount: 2 }).isLive(now)).toBe(false)
  })
})
