import { NumericEntity } from '@shared/domain/entity.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { Money } from '@shared/domain/value-objects/money'
import { InvalidSalePriceError } from '../errors/catalog.errors'
import { Sku } from '../value-objects/sku.vo'
import { VariantSelection } from '../value-objects/variant-selection.vo'

export interface ProductVariantProps {
  sku: Sku
  selection: VariantSelection
  price: Money
  /** Only set while the variant is on sale, and always below `price`. */
  salePrice: Money | null
  weightGrams: number | null
  image: string | null
  isActive: boolean
}

export interface VariantPriceChange {
  price?: Money
  salePrice?: Money | null
}

/**
 * A sellable unit of a product.
 *
 * There is exactly one rule for what a customer pays, and it lives here. The
 * legacy code had four different versions of it spread across listing, search,
 * checkout and the price feed, which disagreed about what a zero or a missing
 * special price meant.
 */
export class ProductVariant extends NumericEntity {
  private props: ProductVariantProps

  private constructor(id: number, props: ProductVariantProps) {
    super(id)
    this.props = props
  }

  static create(props: ProductVariantProps): ProductVariant {
    ProductVariant.assertPricing(props.price, props.salePrice)
    ProductVariant.assertWeight(props.weightGrams)

    return new ProductVariant(UNSAVED_ID, props)
  }

  static fromPersistence(id: number, props: ProductVariantProps): ProductVariant {
    return new ProductVariant(id, props)
  }

  changePricing(change: VariantPriceChange): void {
    const price = change.price ?? this.props.price
    const salePrice = change.salePrice === undefined ? this.props.salePrice : change.salePrice

    ProductVariant.assertPricing(price, salePrice)

    this.props.price = price
    this.props.salePrice = salePrice
  }

  changeSku(sku: Sku): void {
    this.props.sku = sku
  }

  setImage(image: string | null): void {
    const trimmed = image?.trim() ?? ''
    this.props.image = trimmed.length === 0 ? null : trimmed
  }

  setWeight(weightGrams: number | null): void {
    ProductVariant.assertWeight(weightGrams)
    this.props.weightGrams = weightGrams
  }

  activate(): void {
    this.props.isActive = true
  }

  deactivate(): void {
    this.props.isActive = false
  }

  /**
   * What the customer pays. A sale price can only exist if it is a genuine
   * reduction, so there is no ambiguity to resolve here.
   */
  get effectivePrice(): Money {
    return this.props.salePrice ?? this.props.price
  }

  get isOnSale(): boolean {
    return this.props.salePrice !== null
  }

  get discountPercentage(): number {
    return this.props.price.percentageOff(this.effectivePrice)
  }

  /** Order-independent fingerprint of the option values this variant carries. */
  get signature(): string {
    return this.props.selection.signature
  }

  private static assertPricing(price: Money, salePrice: Money | null): void {
    if (price.isZero) {
      throw new InvalidInputError('A variant needs a price above zero')
    }

    if (salePrice === null) {
      return
    }

    if (salePrice.isZero || !salePrice.isLessThan(price)) {
      throw new InvalidSalePriceError()
    }
  }

  private static assertWeight(weightGrams: number | null): void {
    if (weightGrams === null) {
      return
    }

    if (!Number.isInteger(weightGrams) || weightGrams <= 0) {
      throw new InvalidInputError('Weight must be a whole number of grams above zero')
    }
  }

  get sku(): Sku {
    return this.props.sku
  }

  get selection(): VariantSelection {
    return this.props.selection
  }

  get price(): Money {
    return this.props.price
  }

  get salePrice(): Money | null {
    return this.props.salePrice
  }

  get weightGrams(): number | null {
    return this.props.weightGrams
  }

  get image(): string | null {
    return this.props.image
  }

  get isActive(): boolean {
    return this.props.isActive
  }
}
