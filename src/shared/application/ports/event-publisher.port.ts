import { DomainEvent } from '@shared/domain/domain-event'

/**
 * Publishes the events an aggregate recorded while handling a command.
 * Repositories call this right after a successful write, so a handler never
 * reacts to a change that was rolled back.
 */
export interface EventPublisher {
  publish(events: readonly DomainEvent[]): Promise<void>
}

export const EVENT_PUBLISHER = Symbol('EventPublisher')
