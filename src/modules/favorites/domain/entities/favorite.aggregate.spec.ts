import { InvalidInputError } from '@shared/domain/errors'
import { Favorite } from './favorite.aggregate'

describe('Favorite', () => {
  it('records a favorited event on create', () => {
    const favorite = Favorite.create({ userId: 4, productId: 12 })

    expect(favorite.isNew).toBe(true)
    expect(favorite.userId).toBe(4)
    expect(favorite.productId).toBe(12)
    expect(favorite.pullDomainEvents().map((event) => event.name)).toEqual([
      'favorites.product_favorited',
    ])
  })

  it('records an unfavorited event on remove', () => {
    const favorite = Favorite.fromPersistence(7, {
      userId: 4,
      productId: 12,
      favoritedAt: new Date('2026-09-11T12:00:00.000Z'),
    })

    favorite.markRemoved()

    expect(favorite.pullDomainEvents().map((event) => event.name)).toEqual([
      'favorites.product_unfavorited',
    ])
  })

  it('rejects a non-positive product id', () => {
    expect(() => Favorite.create({ userId: 4, productId: 0 })).toThrow(InvalidInputError)
  })
})
