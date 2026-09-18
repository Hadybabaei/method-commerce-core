import {
  BusinessRuleViolationError,
  ConflictError,
  InvalidInputError,
  NotFoundError,
} from '@shared/domain/errors'
import { MAX_CATEGORY_DEPTH } from '../value-objects/category-path.vo'

export class CategoryNotFoundError extends NotFoundError {
  constructor(identifier?: number | string) {
    super('Category not found', identifier === undefined ? undefined : { category: identifier })
  }
}

export class BrandNotFoundError extends NotFoundError {
  constructor(identifier?: number | string) {
    super('Brand not found', identifier === undefined ? undefined : { brand: identifier })
  }
}

export class ProductNotFoundError extends NotFoundError {
  constructor(identifier?: number | string) {
    super('Product not found', identifier === undefined ? undefined : { product: identifier })
  }
}

export class SlugAlreadyTakenError extends ConflictError {
  constructor(slug: string) {
    super('That slug is already in use', { slug })
  }
}

export class SkuAlreadyTakenError extends ConflictError {
  constructor(sku: string) {
    super('That SKU is already in use', { sku })
  }
}

/** A category cannot become its own ancestor. */
export class CategoryCycleError extends BusinessRuleViolationError {
  constructor() {
    super('A category cannot be moved inside itself or one of its descendants')
  }
}

export class CategoryTooDeepError extends BusinessRuleViolationError {
  constructor() {
    super(`Categories can be nested at most ${MAX_CATEGORY_DEPTH + 1} levels deep`)
  }
}

export class CategoryNotEmptyError extends BusinessRuleViolationError {
  constructor(childCount: number, productCount: number) {
    super('Move or delete the contents of this category before deleting it', {
      childCount,
      productCount,
    })
  }
}

export class BrandInUseError extends BusinessRuleViolationError {
  constructor(productCount: number) {
    super('This brand still has products assigned to it', { productCount })
  }
}

/** Guards the invariant that a sale price is always a real reduction. */
export class InvalidSalePriceError extends InvalidInputError {
  constructor() {
    super('The sale price must be greater than zero and lower than the regular price')
  }
}

export class DuplicateOptionError extends ConflictError {
  constructor(name: string) {
    super('This product already has an option with that name', { option: name })
  }
}

export class UnknownOptionError extends InvalidInputError {
  constructor(option: string) {
    super('This product does not declare that option', { option })
  }
}

export class UnknownOptionValueError extends InvalidInputError {
  constructor(option: string, value: string) {
    super('That value is not allowed for this option', { option, value })
  }
}

/**
 * Every variant must carry exactly one value for each option the product
 * declares, otherwise the storefront cannot resolve a selection to a variant.
 */
export class IncompleteVariantError extends BusinessRuleViolationError {
  constructor(expected: number, received: number) {
    super('A variant must have exactly one value for each of the product options', {
      expectedOptions: expected,
      receivedValues: received,
    })
  }
}

export class DuplicateVariantError extends ConflictError {
  constructor() {
    super('A variant with this combination of options already exists')
  }
}

export class VariantNotFoundError extends NotFoundError {
  constructor(identifier?: number | string) {
    super('Variant not found', identifier === undefined ? undefined : { variant: identifier })
  }
}

/** Options cannot change after the first sellable SKU exists. */
export class OptionsLockedError extends BusinessRuleViolationError {
  constructor() {
    super('Product options cannot change after variants have been added')
  }
}

export class InventoryLocationNotFoundError extends NotFoundError {
  constructor(identifier?: number | string) {
    super(
      'Inventory location not found',
      identifier === undefined ? undefined : { location: identifier }
    )
  }
}

export class StockBelowReservedError extends BusinessRuleViolationError {
  constructor(onHand: number, reserved: number) {
    super('On-hand stock cannot be lower than the quantity already reserved', {
      onHand,
      reserved,
    })
  }
}
