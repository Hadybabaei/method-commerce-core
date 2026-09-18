import { InvalidInputError } from '@shared/domain/errors'
import { Basket } from './basket.aggregate'
import { Quantity } from '../value-objects/quantity.vo'
import { BasketItemNotFoundError } from '../errors/basket.errors'

describe('Basket', () => {
  it('merges quantities when the same variant is added twice', () => {
    const basket = Basket.create(4)
    basket.addItem(11, Quantity.of(1))
    basket.addItem(11, Quantity.of(2))

    expect(basket.findItem(11).quantityValue).toBe(3)
    expect(basket.itemCount).toBe(1)
  })

  it('removes a line when quantity is set to zero', () => {
    const basket = Basket.create(4)
    basket.addItem(11, Quantity.of(2))
    basket.setQuantity(11, Quantity.of(0))

    expect(basket.isEmpty).toBe(true)
  })

  it('removes a line when decrease reaches zero', () => {
    const basket = Basket.create(4)
    basket.addItem(11, Quantity.of(1))
    basket.decrease(11, Quantity.of(1))

    expect(basket.isEmpty).toBe(true)
  })

  it('clears every line', () => {
    const basket = Basket.create(4)
    basket.addItem(11, Quantity.of(1))
    basket.addItem(12, Quantity.of(2))
    basket.clear()

    expect(basket.isEmpty).toBe(true)
    expect(basket.totalQuantity).toBe(0)
  })

  it('rejects removing a missing variant', () => {
    const basket = Basket.create(4)
    expect(() => basket.removeItem(99)).toThrow(BasketItemNotFoundError)
  })

  it('rejects a non-integer quantity', () => {
    expect(() => Quantity.of(1.5)).toThrow(InvalidInputError)
  })
})
