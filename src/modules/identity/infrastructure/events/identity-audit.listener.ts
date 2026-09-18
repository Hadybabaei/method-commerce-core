import { Inject, Injectable, LoggerService } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { DomainEvent } from '@shared/domain/domain-event'
import {
  AdminAuthenticatedEvent,
  AdminPasswordChangedEvent,
  AdminPasswordResetRequestedEvent,
  UserAuthenticatedEvent,
  UserRegisteredEvent,
} from '../../domain/events/identity.events'

/**
 * Writes an audit line for security-relevant identity events. Also serves as
 * the reference for how to subscribe to a domain event.
 */
@Injectable()
export class IdentityAuditListener {
  constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {}

  @OnEvent('identity.user.registered')
  onUserRegistered(event: UserRegisteredEvent): void {
    this.audit(event, `New account started for ${event.payload.phoneNumber}`)
  }

  @OnEvent('identity.user.authenticated')
  onUserAuthenticated(event: UserAuthenticatedEvent): void {
    this.audit(event, `User ${event.payload.userId} signed in`)
  }

  @OnEvent('identity.admin.authenticated')
  onAdminAuthenticated(event: AdminAuthenticatedEvent): void {
    this.audit(event, `Admin ${event.payload.email} signed in`)
  }

  @OnEvent('identity.admin.password_changed')
  onAdminPasswordChanged(event: AdminPasswordChangedEvent): void {
    this.audit(event, `Admin ${event.payload.adminId} password changed`)
  }

  @OnEvent('identity.admin.password_reset_requested')
  onAdminPasswordResetRequested(event: AdminPasswordResetRequestedEvent): void {
    this.audit(event, `Password reset requested for admin ${event.payload.email}`)
  }

  private audit(event: DomainEvent, message: string): void {
    this.logger.log({ message, event: event.name, occurredAt: event.occurredAt }, 'Audit')
  }
}
