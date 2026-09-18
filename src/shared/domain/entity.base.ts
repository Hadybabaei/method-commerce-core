import { isUnsaved } from './identifier'

/**
 * Base class for domain entities. Identity is the only thing that defines
 * equality; two entities with the same id are the same entity even if their
 * attributes differ.
 */
export abstract class Entity<TId = number> {
  protected constructor(protected readonly _id: TId) {}

  get id(): TId {
    return this._id
  }

  equals(other?: Entity<TId>): boolean {
    if (!other) return false
    if (this === other) return true
    if (this.constructor !== other.constructor) return false
    return this._id === other._id
  }
}

/**
 * Entity keyed by a database-generated numeric id.
 */
export abstract class NumericEntity extends Entity<number> {
  get isNew(): boolean {
    return isUnsaved(this._id)
  }
}
