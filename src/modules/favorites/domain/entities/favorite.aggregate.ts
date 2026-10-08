import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { FavoriteNotOwnedError } from '../errors/favorites.errors'
import { ProductFavoritedEvent, ProductUnfavoritedEvent } from '../events/favorites.events'

export interface FavoriteProps {
  userId: number
  productId: number
  /** The variant the customer had chosen; null = the product in general. */
  variantId: number | null
  favoritedAt: Date
}

/**
 * One entry in a customer's wishlist. The identity of a favorite is the
 * (user, product) pair; the row id is only there for persistence.
 */
export class Favorite extends AggregateRoot {
  private props: FavoriteProps

  private constructor(id: number, props: FavoriteProps) {
    super(id)
    this.props = props
  }

  static create(input: { userId: number; productId: number; variantId?: number | null }): Favorite {
    if (!Number.isInteger(input.userId) || input.userId <= 0) {
      throw new InvalidInputError('A favorite needs a user')
    }
    if (!Number.isInteger(input.productId) || input.productId <= 0) {
      throw new InvalidInputError('A favorite needs a product')
    }

    const favorite = new Favorite(UNSAVED_ID, {
      userId: input.userId,
      productId: input.productId,
      variantId: input.variantId ?? null,
      favoritedAt: new Date(),
    })
    favorite.addDomainEvent(new ProductFavoritedEvent(input.userId, input.productId))

    return favorite
  }

  static fromPersistence(id: number, props: FavoriteProps): Favorite {
    return new Favorite(id, props)
  }

  ensureOwnedBy(userId: number): void {
    if (this.props.userId !== userId) {
      throw new FavoriteNotOwnedError()
    }
  }

  /** Remembers which size, colour, etc. the customer wants; null forgets it. */
  chooseVariant(variantId: number | null): void {
    this.props.variantId = variantId
  }

  /** Records the removal before the row is deleted. */
  markRemoved(): void {
    this.addDomainEvent(new ProductUnfavoritedEvent(this.props.userId, this.props.productId))
  }

  get userId(): number {
    return this.props.userId
  }

  get productId(): number {
    return this.props.productId
  }

  get variantId(): number | null {
    return this.props.variantId
  }

  get favoritedAt(): Date {
    return this.props.favoritedAt
  }
}
