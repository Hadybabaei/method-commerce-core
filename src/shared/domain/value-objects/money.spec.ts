import { InvalidInputError } from '../errors'
import { MAX_MONEY_AMOUNT, Money } from './money'

describe('Money', () => {
  it('only accepts whole, non-negative amounts within range', () => {
    expect(() => Money.fromMinor(1_500_000)).not.toThrow()
    expect(() => Money.fromMinor(12.5)).toThrow(InvalidInputError)
    expect(() => Money.fromMinor(-1)).toThrow(InvalidInputError)
    expect(() => Money.fromMinor(MAX_MONEY_AMOUNT + 1)).toThrow(InvalidInputError)
  })

  it('adds and multiplies without floating point drift', () => {
    const total = Money.fromMinor(10).add(Money.fromMinor(20)).multiply(3)

    expect(total.amount).toBe(90)
  })

  it('refuses to go negative on subtraction', () => {
    expect(() => Money.fromMinor(100).subtract(Money.fromMinor(101))).toThrow(InvalidInputError)
  })

  it('reports the percentage between a price and its discounted amount', () => {
    expect(Money.fromMinor(200_000).percentageOff(Money.fromMinor(150_000))).toBe(25)
    // A "discount" that is not lower than the price is not a discount.
    expect(Money.fromMinor(200_000).percentageOff(Money.fromMinor(200_000))).toBe(0)
    expect(Money.zero.percentageOff(Money.zero)).toBe(0)
  })

  it('compares by value', () => {
    expect(Money.fromMinor(500).equals(Money.fromMinor(500))).toBe(true)
    expect(Money.fromMinor(500).isLessThan(Money.fromMinor(501))).toBe(true)
  })
})
