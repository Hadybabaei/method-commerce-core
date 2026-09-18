import { AggregateRoot } from '@shared/domain/aggregate-root.base'
import { InvalidInputError } from '@shared/domain/errors'
import { UNSAVED_ID } from '@shared/domain/identifier'
import { AddressNotOwnedError } from '../errors/addressing.errors'
import { GeoPoint } from '../value-objects/geo-point.vo'
import { PostalCode } from '../value-objects/postal-code.vo'
import { Receiver } from '../value-objects/receiver.vo'

export interface AddressProps {
  /** Owning customer. An address never moves between accounts. */
  userId: number
  title: string
  provinceId: number
  cityId: number
  hood: string
  postalCode: PostalCode
  /** Street number. */
  pelak: string
  /** Unit or apartment number. */
  vahed: string | null
  details: string
  receiver: Receiver
  location: GeoPoint | null
}

export interface AddressChanges {
  title?: string
  provinceId?: number
  cityId?: number
  hood?: string
  postalCode?: PostalCode
  pelak?: string
  vahed?: string | null
  details?: string
  receiver?: Receiver
  location?: GeoPoint | null
}

/**
 * A saved delivery address belonging to one customer.
 */
export class Address extends AggregateRoot {
  private props: AddressProps

  private constructor(id: number, props: AddressProps) {
    super(id)
    this.props = props
  }

  static create(props: AddressProps): Address {
    Address.assertTitle(props.title)
    Address.assertRequiredText(props.hood, 'Neighbourhood')
    Address.assertRequiredText(props.pelak, 'Street number')
    Address.assertRequiredText(props.details, 'Address details')

    return new Address(UNSAVED_ID, props)
  }

  static fromPersistence(id: number, props: AddressProps): Address {
    return new Address(id, props)
  }

  /**
   * Guards every read and write of a single address. Callers pass the id from
   * the access token, never from the request body.
   */
  ensureOwnedBy(userId: number): void {
    if (this.props.userId !== userId) {
      throw new AddressNotOwnedError()
    }
  }

  /** Applies only the keys present in `changes`. */
  apply(changes: AddressChanges): void {
    if (changes.title !== undefined) Address.assertTitle(changes.title)
    if (changes.hood !== undefined) Address.assertRequiredText(changes.hood, 'Neighbourhood')
    if (changes.pelak !== undefined) Address.assertRequiredText(changes.pelak, 'Street number')
    if (changes.details !== undefined)
      Address.assertRequiredText(changes.details, 'Address details')

    const next: AddressProps = { ...this.props }

    for (const [key, value] of Object.entries(changes)) {
      if (value !== undefined) {
        Object.assign(next, { [key]: value })
      }
    }

    this.props = next
  }

  private static assertTitle(title: string): void {
    if (!title || title.trim().length < 2) {
      throw new InvalidInputError('Address title must be at least 2 characters long')
    }
  }

  private static assertRequiredText(value: string, label: string): void {
    if (!value || value.trim().length === 0) {
      throw new InvalidInputError(`${label} is required`)
    }
  }

  get userId(): number {
    return this.props.userId
  }

  get title(): string {
    return this.props.title
  }

  get provinceId(): number {
    return this.props.provinceId
  }

  get cityId(): number {
    return this.props.cityId
  }

  get hood(): string {
    return this.props.hood
  }

  get postalCode(): PostalCode {
    return this.props.postalCode
  }

  get pelak(): string {
    return this.props.pelak
  }

  get vahed(): string | null {
    return this.props.vahed
  }

  get details(): string {
    return this.props.details
  }

  get receiver(): Receiver {
    return this.props.receiver
  }

  get location(): GeoPoint | null {
    return this.props.location
  }
}
