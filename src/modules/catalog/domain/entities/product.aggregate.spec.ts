import { Money } from '@shared/domain/value-objects/money'
import {
  DuplicateOptionError,
  DuplicateVariantError,
  IncompleteVariantError,
  InvalidSalePriceError,
  OptionsLockedError,
  UnknownOptionValueError,
} from '../errors/catalog.errors'
import { Sku } from '../value-objects/sku.vo'
import { Slug } from '../value-objects/slug.vo'
import { VariantSelection } from '../value-objects/variant-selection.vo'
import { Product } from './product.aggregate'

function newProduct(): Product {
  return Product.create({
    title: 'دریل شارژی',
    slug: Slug.create('cordless-drill'),
    subTitle: null,
    description: null,
    shortDescription: null,
    published: false,
    weightGrams: 1500,
    categoryId: null,
    brandId: null,
  })
}

function withOptions(): Product {
  const product = newProduct()

  product.addOption('رنگ', ['قرمز', 'آبی'])
  product.addOption('سایز', ['کوچک', 'بزرگ'])

  return product
}

function variantProps(
  sku: string,
  selections: { option: string; value: string }[],
  price = 2_000_000,
  salePrice: number | null = null
) {
  return {
    sku: Sku.create(sku),
    selection: VariantSelection.create(selections),
    price: Money.fromMinor(price),
    salePrice: salePrice === null ? null : Money.fromMinor(salePrice),
    weightGrams: null,
    image: null,
    isActive: true,
  }
}

describe('Product options', () => {
  it('rejects a second option with the same name', () => {
    const product = withOptions()

    expect(() => product.addOption('رنگ', ['سبز'])).toThrow(DuplicateOptionError)
  })
})

describe('Product variants', () => {
  it('requires a value for every option the product declares', () => {
    const product = withOptions()

    expect(() =>
      product.addVariant(variantProps('DRL-1', [{ option: 'رنگ', value: 'قرمز' }]))
    ).toThrow(IncompleteVariantError)
  })

  it('rejects a value the option does not offer', () => {
    const product = withOptions()

    expect(() =>
      product.addVariant(
        variantProps('DRL-1', [
          { option: 'رنگ', value: 'بنفش' },
          { option: 'سایز', value: 'بزرگ' },
        ])
      )
    ).toThrow(UnknownOptionValueError)
  })

  it('rejects the same combination twice, whatever order it arrives in', () => {
    const product = withOptions()

    product.addVariant(
      variantProps('DRL-1', [
        { option: 'رنگ', value: 'قرمز' },
        { option: 'سایز', value: 'بزرگ' },
      ])
    )

    expect(() =>
      product.addVariant(
        variantProps('DRL-2', [
          { option: 'سایز', value: 'بزرگ' },
          { option: 'رنگ', value: 'قرمز' },
        ])
      )
    ).toThrow(DuplicateVariantError)
  })

  it('resolves a customer selection back to one variant', () => {
    const product = withOptions()
    const added = product.addVariant(
      variantProps('DRL-1', [
        { option: 'رنگ', value: 'آبی' },
        { option: 'سایز', value: 'کوچک' },
      ])
    )

    const found = product.findVariantBySelection(
      VariantSelection.create([
        { option: 'سایز', value: 'کوچک' },
        { option: 'رنگ', value: 'آبی' },
      ])
    )

    expect(found).toBe(added)
  })

  it('rejects option picks when the product has no option axes', () => {
    const product = newProduct()

    expect(() =>
      product.addVariant(variantProps('DRL-1', [{ option: 'رنگ', value: 'قرمز' }]))
    ).toThrow(IncompleteVariantError)
  })

  it('adds a default variant when the product has no options', () => {
    const product = newProduct()
    const variant = product.addVariant({
      sku: Sku.create('DRL-1'),
      selection: VariantSelection.none(),
      price: Money.fromMinor(2_000_000),
      salePrice: null,
      weightGrams: null,
      image: null,
      isActive: true,
    })

    expect(variant.signature).toBe('')
    expect(product.variants).toHaveLength(1)
  })

  it('rejects a second default variant', () => {
    const product = newProduct()
    const props = {
      sku: Sku.create('DRL-1'),
      selection: VariantSelection.none(),
      price: Money.fromMinor(2_000_000),
      salePrice: null,
      weightGrams: null,
      image: null,
      isActive: true,
    }
    product.addVariant(props)

    expect(() =>
      product.addVariant({
        ...props,
        sku: Sku.create('DRL-2'),
      })
    ).toThrow(DuplicateVariantError)
  })
})

describe('Product option lock', () => {
  it('refuses to change options after a variant exists', () => {
    const product = newProduct()
    product.addVariant({
      sku: Sku.create('DRL-1'),
      selection: VariantSelection.none(),
      price: Money.fromMinor(2_000_000),
      salePrice: null,
      weightGrams: null,
      image: null,
      isActive: true,
    })

    expect(() => product.addOption('رنگ', ['قرمز'])).toThrow(OptionsLockedError)
    expect(() => product.replaceOptions([{ name: 'رنگ', values: ['قرمز'] }])).toThrow(
      OptionsLockedError
    )
  })

  it('replaces options while there are still no variants', () => {
    const product = newProduct()
    product.replaceOptions([{ name: 'رنگ', values: ['قرمز', 'آبی'] }])

    expect(product.options).toHaveLength(1)
    expect(product.options[0].values.map((value) => value.value)).toEqual(['قرمز', 'آبی'])
  })
})

describe('Variant pricing', () => {
  const selection = [
    { option: 'رنگ', value: 'قرمز' },
    { option: 'سایز', value: 'بزرگ' },
  ]

  it('charges the sale price when one is set', () => {
    const product = withOptions()
    const variant = product.addVariant(variantProps('DRL-1', selection, 2_000_000, 1_500_000))

    expect(variant.effectivePrice.amount).toBe(1_500_000)
    expect(variant.isOnSale).toBe(true)
    expect(variant.discountPercentage).toBe(25)
  })

  it('charges the regular price when there is no sale', () => {
    const product = withOptions()
    const variant = product.addVariant(variantProps('DRL-1', selection, 2_000_000))

    expect(variant.effectivePrice.amount).toBe(2_000_000)
    expect(variant.isOnSale).toBe(false)
    expect(variant.discountPercentage).toBe(0)
  })

  it('refuses a sale price that is not a reduction', () => {
    const product = withOptions()

    // A zero or higher "special price" was the ambiguity in the old schema:
    // here it simply cannot be stored.
    expect(() => product.addVariant(variantProps('DRL-1', selection, 2_000_000, 0))).toThrow(
      InvalidSalePriceError
    )
    expect(() =>
      product.addVariant(variantProps('DRL-2', selection, 2_000_000, 2_000_000))
    ).toThrow(InvalidSalePriceError)
    expect(() =>
      product.addVariant(variantProps('DRL-3', selection, 2_000_000, 2_500_000))
    ).toThrow(InvalidSalePriceError)
  })

  it('reports the price range across active variants only', () => {
    const product = withOptions()

    product.addVariant(
      variantProps(
        'DRL-1',
        [
          { option: 'رنگ', value: 'قرمز' },
          { option: 'سایز', value: 'بزرگ' },
        ],
        3_000_000
      )
    )
    product.addVariant(
      variantProps(
        'DRL-2',
        [
          { option: 'رنگ', value: 'آبی' },
          { option: 'سایز', value: 'کوچک' },
        ],
        2_000_000,
        1_800_000
      )
    )
    const hidden = product.addVariant(
      variantProps(
        'DRL-3',
        [
          { option: 'رنگ', value: 'آبی' },
          { option: 'سایز', value: 'بزرگ' },
        ],
        9_000_000
      )
    )
    hidden.deactivate()

    expect(product.priceRange).toEqual({
      min: Money.fromMinor(1_800_000),
      max: Money.fromMinor(3_000_000),
    })
  })

  it('has no price range before it has variants', () => {
    expect(newProduct().priceRange).toBeNull()
  })
})

describe('Product publishing', () => {
  it('announces a change in visibility once saved', () => {
    const product = Product.fromPersistence(9, {
      title: 'دریل شارژی',
      slug: Slug.create('cordless-drill'),
      subTitle: null,
      description: null,
      shortDescription: null,
      published: false,
      weightGrams: 1500,
      categoryId: null,
      brandId: null,
      images: [],
      options: [],
      variants: [],
    })

    product.publish()
    product.publish()

    const events = product.pullDomainEvents()

    expect(events).toHaveLength(1)
    expect(events[0].name).toBe('catalog.product.published')
  })

  it('stays quiet for a product that has never been saved', () => {
    const product = newProduct()

    product.publish()

    expect(product.pullDomainEvents()).toHaveLength(0)
  })
})
