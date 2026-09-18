import { DomainEvent } from './domain-event'
import { NumericEntity } from './entity.base'

/**
 * Consistency boundary. Only aggregate roots are loaded and saved by
 * repositories, and they are the only place domain events are recorded.
 *
 * An aggregate records an event when its state changes; the repository drains
 * and publishes them once the write has committed. Something that changes no
 * state (a successful login, say) is announced by the use case instead.
 */
export abstract class AggregateRoot extends NumericEntity {
  private _domainEvents: DomainEvent[] = []

  get domainEvents(): readonly DomainEvent[] {
    return [...this._domainEvents]
  }

  protected addDomainEvent(event: DomainEvent): void {
    this._domainEvents.push(event)
  }

  pullDomainEvents(): DomainEvent[] {
    const events = this._domainEvents
    this._domainEvents = []
    return events
  }
}
