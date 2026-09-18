/**
 * Base class for value objects: immutable, no identity, compared by value.
 */
export abstract class ValueObject<TProps extends object> {
  protected readonly props: TProps

  protected constructor(props: TProps) {
    this.props = Object.freeze({ ...props })
  }

  equals(other?: ValueObject<TProps>): boolean {
    if (!other) return false
    if (this === other) return true
    if (this.constructor !== other.constructor) return false
    return JSON.stringify(this.props) === JSON.stringify(other.props)
  }

  unpack(): TProps {
    return this.props
  }
}
