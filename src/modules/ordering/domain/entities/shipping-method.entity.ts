import { NumericEntity } from '@shared/domain/entity.base'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { Money } from '@shared/domain/value-objects/money'
import { InvalidShippingMethodError } from '../errors/ordering.errors'

const CODE_PATTERN = /^[a-z0-9][a-z0-9-]{0,49}$/
const GRAMS_PER_KG = 1000

export interface ShippingMethodProps {
  name: string
  code: string
  description: string | null
  baseFee: Money
  perKgFee: Money
  /** Subtotal at or above which shipping is free; null = never free. */
  freeAbove: Money | null
  minDays: number | null
  maxDays: number | null
  /** Province ids served; null = every province. */
  provinceIds: number[] | null
  /** Contains `{code}`, replaced with the parcel's tracking code. */
  trackingUrlTemplate: string | null
  isActive: boolean
  position: number
}

export type ShippingMethodInput = {
  name: string
  code: string
  description?: string | null
  baseFee: number
  perKgFee?: number
  freeAbove?: number | null
  minDays?: number | null
  maxDays?: number | null
  provinceIds?: number[] | null
  trackingUrlTemplate?: string | null
  isActive?: boolean
  position?: number
}

/** What an order keeps of the method it shipped with. */
export interface ShippingSnapshot {
  methodId: number
  name: string
  code: string
  minDays: number | null
  maxDays: number | null
  trackingUrlTemplate: string | null
}

/**
 * A delivery option offered at checkout. The fee is the base fee plus the
 * per-kg fee for every started kilogram, waived when the subtotal reaches
 * `freeAbove`.
 */
export class ShippingMethod extends NumericEntity {
  private props: ShippingMethodProps

  private constructor(id: number, props: ShippingMethodProps) {
    super(id)
    this.props = props
  }

  static create(input: ShippingMethodInput): ShippingMethod {
    return new ShippingMethod(UNSAVED_ID, ShippingMethod.validate(input))
  }

  static fromPersistence(id: number, props: ShippingMethodProps): ShippingMethod {
    return new ShippingMethod(id, props)
  }

  /** Replaces the editable fields; omitted optional fields fall back to the current value. */
  update(input: Partial<ShippingMethodInput>): void {
    this.props = ShippingMethod.validate({
      name: input.name ?? this.props.name,
      code: input.code ?? this.props.code,
      description: input.description !== undefined ? input.description : this.props.description,
      baseFee: input.baseFee ?? this.props.baseFee.amount,
      perKgFee: input.perKgFee ?? this.props.perKgFee.amount,
      freeAbove: input.freeAbove !== undefined ? input.freeAbove : this.props.freeAbove?.amount,
      minDays: input.minDays !== undefined ? input.minDays : this.props.minDays,
      maxDays: input.maxDays !== undefined ? input.maxDays : this.props.maxDays,
      provinceIds: input.provinceIds !== undefined ? input.provinceIds : this.props.provinceIds,
      trackingUrlTemplate:
        input.trackingUrlTemplate !== undefined
          ? input.trackingUrlTemplate
          : this.props.trackingUrlTemplate,
      isActive: input.isActive ?? this.props.isActive,
      position: input.position ?? this.props.position,
    })
  }

  servesProvince(provinceId: number): boolean {
    return this.props.provinceIds === null || this.props.provinceIds.includes(provinceId)
  }

  quote(input: { weightGrams: number; subtotal: Money }): Money {
    const { freeAbove } = this.props
    if (freeAbove !== null && !input.subtotal.isLessThan(freeAbove)) {
      return Money.zero
    }

    const startedKilograms = Math.max(1, Math.ceil(input.weightGrams / GRAMS_PER_KG))
    return this.props.baseFee.add(this.props.perKgFee.multiply(startedKilograms))
  }

  toSnapshot(): ShippingSnapshot {
    return {
      methodId: this.id,
      name: this.props.name,
      code: this.props.code,
      minDays: this.props.minDays,
      maxDays: this.props.maxDays,
      trackingUrlTemplate: this.props.trackingUrlTemplate,
    }
  }

  get name(): string {
    return this.props.name
  }

  get code(): string {
    return this.props.code
  }

  get description(): string | null {
    return this.props.description
  }

  get baseFee(): Money {
    return this.props.baseFee
  }

  get perKgFee(): Money {
    return this.props.perKgFee
  }

  get freeAbove(): Money | null {
    return this.props.freeAbove
  }

  get minDays(): number | null {
    return this.props.minDays
  }

  get maxDays(): number | null {
    return this.props.maxDays
  }

  get provinceIds(): number[] | null {
    return this.props.provinceIds
  }

  get trackingUrlTemplate(): string | null {
    return this.props.trackingUrlTemplate
  }

  get isActive(): boolean {
    return this.props.isActive
  }

  get position(): number {
    return this.props.position
  }

  private static validate(input: ShippingMethodInput): ShippingMethodProps {
    const name = input.name.trim()
    if (!name || name.length > 100) {
      throw new InvalidShippingMethodError('Name must be 1 to 100 characters', { name })
    }

    const code = input.code.trim().toLowerCase()
    if (!CODE_PATTERN.test(code)) {
      throw new InvalidShippingMethodError(
        'Code must be lowercase letters, digits and dashes (max 50)',
        { code }
      )
    }

    const minDays = input.minDays ?? null
    const maxDays = input.maxDays ?? null
    for (const days of [minDays, maxDays]) {
      if (days !== null && (!Number.isInteger(days) || days < 0 || days > 365)) {
        throw new InvalidShippingMethodError('Delivery days must be whole numbers from 0 to 365', {
          minDays,
          maxDays,
        })
      }
    }
    if (minDays !== null && maxDays !== null && minDays > maxDays) {
      throw new InvalidShippingMethodError('minDays cannot be greater than maxDays', {
        minDays,
        maxDays,
      })
    }

    const provinceIds = input.provinceIds ?? null
    if (provinceIds !== null) {
      if (provinceIds.length === 0) {
        throw new InvalidShippingMethodError(
          'provinceIds cannot be empty; use null to serve every province'
        )
      }
      if (provinceIds.some((id) => !Number.isInteger(id) || id < 1)) {
        throw new InvalidShippingMethodError('provinceIds must be positive ids', { provinceIds })
      }
    }

    const template = input.trackingUrlTemplate?.trim() || null
    if (template !== null && (!/^https?:\/\//.test(template) || !template.includes('{code}'))) {
      throw new InvalidShippingMethodError(
        'trackingUrlTemplate must be an http(s) URL containing {code}',
        { trackingUrlTemplate: template }
      )
    }

    const position = input.position ?? 0
    if (!Number.isInteger(position)) {
      throw new InvalidShippingMethodError('position must be a whole number', { position })
    }

    return {
      name,
      code,
      description: input.description?.trim() || null,
      baseFee: Money.fromMinor(input.baseFee),
      perKgFee: Money.fromMinor(input.perKgFee ?? 0),
      freeAbove:
        input.freeAbove === undefined || input.freeAbove === null
          ? null
          : Money.fromMinor(input.freeAbove),
      minDays,
      maxDays,
      provinceIds: provinceIds === null ? null : [...new Set(provinceIds)].sort((a, b) => a - b),
      trackingUrlTemplate: template,
      isActive: input.isActive ?? true,
      position,
    }
  }
}
