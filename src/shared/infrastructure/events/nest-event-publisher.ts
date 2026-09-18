import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { EventEmitter2 } from '@nestjs/event-emitter'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { EventPublisher } from '@shared/application/ports/event-publisher.port'
import { DomainEvent } from '@shared/domain/domain-event'

/**
 * In-process transport. Handlers subscribe with `@OnEvent('<event name>')`.
 *
 * A failing handler is logged but never propagated: the command it followed has
 * already been committed, so failing the request would misreport the outcome.
 */
@Injectable()
export class NestEventPublisher implements EventPublisher {
  constructor(
    private readonly emitter: EventEmitter2,
    @Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService
  ) {}

  async publish(events: readonly DomainEvent[]): Promise<void> {
    for (const event of events) {
      try {
        await this.emitter.emitAsync(event.name, event)
      } catch (error) {
        this.logger.error(
          `Handler for ${event.name} failed`,
          error instanceof Error ? error.stack : undefined,
          'EventPublisher'
        )
      }
    }
  }
}
