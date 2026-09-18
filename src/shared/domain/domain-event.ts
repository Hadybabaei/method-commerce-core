export interface DomainEvent<TPayload = unknown> {
  readonly name: string
  readonly occurredAt: Date
  readonly payload: TPayload
}

export abstract class BaseDomainEvent<TPayload> implements DomainEvent<TPayload> {
  readonly occurredAt: Date = new Date()

  protected constructor(
    readonly name: string,
    readonly payload: TPayload
  ) {}
}
