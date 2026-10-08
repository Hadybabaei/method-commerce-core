import { NumericEntity } from '@shared/domain/entity.base'
import { InvalidInputError, BusinessRuleViolationError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'

export enum PromotionKind {
  Percent = 'PERCENT',
  Fixed = 'FIXED',
  FreeShipping = 'FREE_SHIPPING',
}

export const PROMOTION_KINDS = Object.values(PromotionKind)

const CODE_PATTERN = /^[A-Z0-9][A-Z0-9_-]{2,39}$/

export class InvalidPromotionError extends InvalidInputError {}

/** A coupon the customer typed that cannot be used on this basket. */
export class CouponNotApplicableError extends BusinessRuleViolationError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, details)
  }
}

export interface PromotionProps {
  name: string
  /** Uppercase; null for automatic campaigns. */
  code: string | null
  kind: PromotionKind
  /** PERCENT: 1–100. FIXED: Rial. FREE_SHIPPING: 0. */
  value: number
  maxDiscount: number | null
  minSubtotal: number | null
  startsAt: Date
  endsAt: Date | null
  usageLimit: number | null
  perCustomerLimit: number | null
  categoryIds: number[] | null
  brandIds: number[] | null
  isActive: boolean
  usedCount: number
}

export type PromotionInput = Omit<PromotionProps, 'usedCount' | 'code' | 'isActive'> & {
  code?: string | null
  isActive?: boolean
}

/** One basket line as the promotion engine sees it. */
export interface PricedLine {
  categoryId: number | null
  /** Ancestor ids of the category, e.g. "/1/7/". */
  categoryPath: string | null
  brandId: number | null
  /** Rial, before discount. */
  lineTotal: number
}

export interface PromotionDiscount {
  /** Rial off goods, to spread over the eligible lines. */
  goods: number
  /** Rial off shipping. */
  shipping: number
  /** Which lines the goods discount may touch, same order as the input. */
  eligible: boolean[]
}

/**
 * A coupon (code) or an automatic campaign (no code). evaluate() says what it
 * is worth for a basket, or why it does not apply.
 */
export class Promotion extends NumericEntity {
  private constructor(
    id: number,
    private props: PromotionProps
  ) {
    super(id)
  }

  static create(input: PromotionInput): Promotion {
    return new Promotion(
      UNSAVED_ID,
      Promotion.validate({
        ...input,
        code: input.code ?? null,
        isActive: input.isActive ?? true,
        usedCount: 0,
      })
    )
  }

  static fromPersistence(id: number, props: PromotionProps): Promotion {
    return new Promotion(id, props)
  }

  update(changes: Partial<PromotionInput>): void {
    const merged = { ...this.props, ...stripUndefined(changes) } as PromotionProps
    this.props = Promotion.validate(merged)
  }

  static normalizeCode(code: string): string {
    return code.trim().toUpperCase()
  }

  isLive(now: Date): boolean {
    return (
      this.props.isActive &&
      this.props.startsAt <= now &&
      (this.props.endsAt === null || now < this.props.endsAt) &&
      (this.props.usageLimit === null || this.props.usedCount < this.props.usageLimit)
    )
  }

  /** Whether a line is in the promotion's category/brand scope. Empty scope = everything. */
  covers(line: PricedLine): boolean {
    const { categoryIds, brandIds } = this.props
    if (categoryIds === null && brandIds === null) return true

    const inCategory =
      categoryIds !== null &&
      line.categoryId !== null &&
      categoryIds.some(
        (id) => id === line.categoryId || (line.categoryPath ?? '').includes(`/${id}/`)
      )
    const inBrand = brandIds !== null && line.brandId !== null && brandIds.includes(line.brandId)
    return inCategory || inBrand
  }

  /** What this promotion takes off the basket; throws when it does not apply. */
  evaluate(input: { lines: PricedLine[]; shippingFee: number; now: Date }): PromotionDiscount {
    if (!this.isLive(input.now)) {
      throw new CouponNotApplicableError('This code has expired or is no longer available', {
        code: this.props.code,
      })
    }

    const eligible = input.lines.map((line) => this.covers(line))
    const eligibleSubtotal = input.lines.reduce(
      (sum, line, index) => sum + (eligible[index] ? line.lineTotal : 0),
      0
    )
    if (eligibleSubtotal === 0) {
      throw new CouponNotApplicableError('This code does not apply to anything in the basket', {
        code: this.props.code,
      })
    }
    if (this.props.minSubtotal !== null && eligibleSubtotal < this.props.minSubtotal) {
      throw new CouponNotApplicableError('The basket is below the minimum for this code', {
        code: this.props.code,
        minSubtotal: this.props.minSubtotal,
        eligibleSubtotal,
      })
    }

    switch (this.props.kind) {
      case PromotionKind.Percent: {
        const raw = Math.floor((eligibleSubtotal * this.props.value) / 100)
        const goods = this.props.maxDiscount === null ? raw : Math.min(raw, this.props.maxDiscount)
        return { goods, shipping: 0, eligible }
      }
      case PromotionKind.Fixed:
        return { goods: Math.min(this.props.value, eligibleSubtotal), shipping: 0, eligible }
      case PromotionKind.FreeShipping:
        if (input.shippingFee === 0) {
          throw new CouponNotApplicableError('Shipping is already free for this order', {
            code: this.props.code,
          })
        }
        return { goods: 0, shipping: input.shippingFee, eligible }
    }
  }

  get name(): string {
    return this.props.name
  }
  get code(): string | null {
    return this.props.code
  }
  get kind(): PromotionKind {
    return this.props.kind
  }
  get value(): number {
    return this.props.value
  }
  get maxDiscount(): number | null {
    return this.props.maxDiscount
  }
  get minSubtotal(): number | null {
    return this.props.minSubtotal
  }
  get startsAt(): Date {
    return this.props.startsAt
  }
  get endsAt(): Date | null {
    return this.props.endsAt
  }
  get usageLimit(): number | null {
    return this.props.usageLimit
  }
  get perCustomerLimit(): number | null {
    return this.props.perCustomerLimit
  }
  get categoryIds(): number[] | null {
    return this.props.categoryIds
  }
  get brandIds(): number[] | null {
    return this.props.brandIds
  }
  get isActive(): boolean {
    return this.props.isActive
  }
  get usedCount(): number {
    return this.props.usedCount
  }

  private static validate(props: PromotionProps): PromotionProps {
    const name = props.name.trim()
    if (!name || name.length > 191) {
      throw new InvalidPromotionError('Name must be 1 to 191 characters')
    }

    const code = props.code ? Promotion.normalizeCode(props.code) : null
    if (code !== null && !CODE_PATTERN.test(code)) {
      throw new InvalidPromotionError(
        'Code must be 3 to 40 letters, digits, dashes or underscores',
        { code }
      )
    }

    const wholeAtLeast = (value: number | null, min: number) =>
      value === null || (Number.isInteger(value) && value >= min && value <= MAX_MONEY_AMOUNT)

    if (
      props.kind === PromotionKind.Percent &&
      !(Number.isInteger(props.value) && props.value >= 1 && props.value <= 100)
    ) {
      throw new InvalidPromotionError('A percent discount must be 1 to 100', { value: props.value })
    }
    if (props.kind === PromotionKind.Fixed && !wholeAtLeast(props.value, 1)) {
      throw new InvalidPromotionError('A fixed discount must be a whole number of Rial above 0', {
        value: props.value,
      })
    }
    const value = props.kind === PromotionKind.FreeShipping ? 0 : props.value

    for (const [label, field, min] of [
      ['maxDiscount', props.maxDiscount, 1],
      ['minSubtotal', props.minSubtotal, 0],
      ['usageLimit', props.usageLimit, 1],
      ['perCustomerLimit', props.perCustomerLimit, 1],
    ] as const) {
      if (!wholeAtLeast(field, min)) {
        throw new InvalidPromotionError(`${label} must be a whole number of at least ${min}`, {
          [label]: field,
        })
      }
    }

    if (Number.isNaN(props.startsAt.getTime())) {
      throw new InvalidPromotionError('startsAt must be a date')
    }
    if (props.endsAt !== null && props.endsAt <= props.startsAt) {
      throw new InvalidPromotionError('endsAt must be after startsAt')
    }

    const ids = (list: number[] | null, label: string) => {
      if (list === null) return null
      if (list.length === 0 || list.some((id) => !Number.isInteger(id) || id < 1)) {
        throw new InvalidPromotionError(`${label} must be positive ids, or null for everything`)
      }
      return [...new Set(list)].sort((a, b) => a - b)
    }

    return {
      ...props,
      name,
      code,
      value,
      maxDiscount: props.kind === PromotionKind.Percent ? props.maxDiscount : null,
      categoryIds: ids(props.categoryIds, 'categoryIds'),
      brandIds: ids(props.brandIds, 'brandIds'),
    }
  }
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>
}
