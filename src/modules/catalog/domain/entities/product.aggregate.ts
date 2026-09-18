import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { Money } from '@shared/domain/value-objects/money'
import {
  DuplicateOptionError,
  DuplicateVariantError,
  IncompleteVariantError,
  OptionsLockedError,
  SkuAlreadyTakenError,
  UnknownOptionError,
  UnknownOptionValueError,
  VariantNotFoundError,
} from '../errors/catalog.errors'
import { ProductPublishedEvent, ProductUnpublishedEvent } from '../events/catalog.events'
import { ProductImage } from '../value-objects/product-image.vo'
import { Sku } from '../value-objects/sku.vo'
import { Slug } from '../value-objects/slug.vo'
import { VariantSelection } from '../value-objects/variant-selection.vo'
import { ProductOption } from './product-option.entity'
import { ProductVariant, ProductVariantProps } from './product-variant.entity'

export interface ProductProps {
  title: string
  subTitle: string | null
  slug: Slug
  description: string | null
  shortDescription: string | null
  published: boolean
  /** Shipping weight used when a variant does not override it. */
  weightGrams: number
  categoryId: number | null
  brandId: number | null
  images: ProductImage[]
  options: ProductOption[]
  variants: ProductVariant[]
}

export interface ProductChanges {
  title?: string
  subTitle?: string | null
  slug?: Slug
  description?: string | null
  shortDescription?: string | null
  weightGrams?: number
  categoryId?: number | null
  brandId?: number | null
}

export interface PriceRange {
  min: Money
  max: Money
}

export type NewProductProps = Omit<ProductProps, 'images' | 'options' | 'variants'> &
  Partial<Pick<ProductProps, 'images' | 'options' | 'variants'>>

/**
 * A catalog entry, and the consistency boundary for everything that describes
 * it: its images, the options it varies on, and its variants.
 *
 * Options and variants belong inside this boundary rather than in aggregates
 * of their own because the rule that connects them — every variant answers
 * every option exactly once — cannot be checked from outside.
 */
export class Product extends AggregateRoot {
  private props: ProductProps

  private constructor(id: number, props: ProductProps) {
    super(id)
    this.props = props
  }

  static create(props: NewProductProps): Product {
    Product.assertTitle(props.title)
    Product.assertWeight(props.weightGrams)

    return new Product(UNSAVED_ID, {
      ...props,
      images: props.images ?? [],
      options: props.options ?? [],
      variants: props.variants ?? [],
    })
  }

  static fromPersistence(id: number, props: ProductProps): Product {
    return new Product(id, props)
  }

  apply(changes: ProductChanges): void {
    if (changes.title !== undefined) {
      Product.assertTitle(changes.title)
      this.props.title = changes.title
    }

    if (changes.weightGrams !== undefined) {
      Product.assertWeight(changes.weightGrams)
      this.props.weightGrams = changes.weightGrams
    }

    if (changes.subTitle !== undefined) this.props.subTitle = changes.subTitle
    if (changes.slug !== undefined) this.props.slug = changes.slug
    if (changes.description !== undefined) this.props.description = changes.description
    if (changes.shortDescription !== undefined) {
      this.props.shortDescription = changes.shortDescription
    }
    if (changes.categoryId !== undefined) this.props.categoryId = changes.categoryId
    if (changes.brandId !== undefined) this.props.brandId = changes.brandId
  }

  publish(): void {
    if (this.props.published) {
      return
    }

    this.props.published = true
    this.announceVisibility()
  }

  unpublish(): void {
    if (!this.props.published) {
      return
    }

    this.props.published = false
    this.announceVisibility()
  }

  /**
   * A product created as published has no id to announce yet, and the fact it
   * exists at all is already news; only a later change is worth an event.
   */
  private announceVisibility(): void {
    if (this.isNew) {
      return
    }

    this.addDomainEvent(
      this.props.published
        ? new ProductPublishedEvent(this.id, this.props.slug.value)
        : new ProductUnpublishedEvent(this.id, this.props.slug.value)
    )
  }

  /** Images are always sent as a complete list, so they are replaced wholesale. */
  replaceImages(images: ProductImage[]): void {
    this.props.images = [...images]
  }

  addOption(name: string, values: string[]): ProductOption {
    this.assertOptionsUnlocked()

    if (this.props.options.some((option) => option.hasName(name))) {
      throw new DuplicateOptionError(name)
    }

    const option = ProductOption.create(name, values, this.props.options.length)
    this.props.options.push(option)

    return option
  }

  /**
   * Replaces the option axes. Only allowed before the first variant exists so
   * existing SKUs cannot become incomplete.
   */
  replaceOptions(options: ReadonlyArray<{ name: string; values: string[] }>): void {
    this.assertOptionsUnlocked()
    this.props.options = []

    for (const option of options) {
      this.addOption(option.name, option.values)
    }
  }

  /**
   * Adds a sellable unit. The selection must answer every option the product
   * declares. A product with no options may have exactly one default variant
   * whose selection is empty.
   */
  addVariant(props: ProductVariantProps): ProductVariant {
    this.assertSelectionIsComplete(props.selection)

    if (this.props.variants.some((variant) => variant.signature === props.selection.signature)) {
      throw new DuplicateVariantError()
    }

    if (this.props.variants.some((variant) => variant.sku.value === props.sku.value)) {
      throw new SkuAlreadyTakenError(props.sku.value)
    }

    const variant = ProductVariant.create(props)
    this.props.variants.push(variant)

    return variant
  }

  removeVariant(sku: string): void {
    this.props.variants = this.props.variants.filter((variant) => variant.sku.value !== sku)
  }

  removeVariantById(variantId: number): void {
    this.requireVariant(variantId)
    this.props.variants = this.props.variants.filter((variant) => variant.id !== variantId)
  }

  requireVariant(variantId: number): ProductVariant {
    const variant = this.findVariantById(variantId)

    if (!variant) {
      throw new VariantNotFoundError(variantId)
    }

    return variant
  }

  changeVariantSku(variantId: number, sku: Sku): void {
    const variant = this.requireVariant(variantId)

    if (this.props.variants.some((other) => other.sku.value === sku.value && other.id !== variantId)) {
      throw new SkuAlreadyTakenError(sku.value)
    }

    variant.changeSku(sku)
  }

  findVariantById(variantId: number): ProductVariant | null {
    return this.props.variants.find((variant) => variant.id === variantId) ?? null
  }

  findVariantBySku(sku: string): ProductVariant | null {
    return this.props.variants.find((variant) => variant.sku.value === sku) ?? null
  }

  private assertOptionsUnlocked(): void {
    if (this.props.variants.length > 0) {
      throw new OptionsLockedError()
    }
  }

  /** Resolves a customer's option picks to the one variant that matches. */
  findVariantBySelection(selection: VariantSelection): ProductVariant | null {
    return this.props.variants.find((variant) => variant.signature === selection.signature) ?? null
  }

  private assertSelectionIsComplete(selection: VariantSelection): void {
    if (selection.selections.length !== this.props.options.length) {
      throw new IncompleteVariantError(this.props.options.length, selection.selections.length)
    }

    for (const chosen of selection.selections) {
      const option = this.props.options.find((candidate) => candidate.hasName(chosen.option))

      if (!option) {
        throw new UnknownOptionError(chosen.option)
      }

      if (!option.findValue(chosen.value)) {
        throw new UnknownOptionValueError(chosen.option, chosen.value)
      }
    }
  }

  private static assertTitle(title: string): void {
    if (!title || title.trim().length < 2) {
      throw new InvalidInputError('Product title must be at least 2 characters long')
    }
  }

  private static assertWeight(weightGrams: number): void {
    if (!Number.isInteger(weightGrams) || weightGrams <= 0) {
      throw new InvalidInputError('Weight must be a whole number of grams above zero')
    }
  }

  /** Cheapest and dearest of what is actually on sale right now. */
  get priceRange(): PriceRange | null {
    const prices = this.activeVariants.map((variant) => variant.effectivePrice)

    if (prices.length === 0) {
      return null
    }

    return prices.reduce<PriceRange>(
      (range, price) => ({
        min: price.isLessThan(range.min) ? price : range.min,
        max: price.isGreaterThan(range.max) ? price : range.max,
      }),
      { min: prices[0], max: prices[0] }
    )
  }

  get activeVariants(): ProductVariant[] {
    return this.props.variants.filter((variant) => variant.isActive)
  }

  get thumbnail(): ProductImage | null {
    return this.props.images.find((image) => image.isThumbnail) ?? this.props.images[0] ?? null
  }

  get title(): string {
    return this.props.title
  }

  get subTitle(): string | null {
    return this.props.subTitle
  }

  get slug(): Slug {
    return this.props.slug
  }

  get description(): string | null {
    return this.props.description
  }

  get shortDescription(): string | null {
    return this.props.shortDescription
  }

  get published(): boolean {
    return this.props.published
  }

  get weightGrams(): number {
    return this.props.weightGrams
  }

  get categoryId(): number | null {
    return this.props.categoryId
  }

  get brandId(): number | null {
    return this.props.brandId
  }

  get images(): readonly ProductImage[] {
    return this.props.images
  }

  get options(): readonly ProductOption[] {
    return this.props.options
  }

  get variants(): readonly ProductVariant[] {
    return this.props.variants
  }
}
