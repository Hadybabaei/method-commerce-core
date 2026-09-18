import { BaseDomainEvent } from '@shared/domain/domain-event'
import { NotificationAudience } from '../enums/notification.enums'

export class NotificationIssuedEvent extends BaseDomainEvent<{
  notificationId: number
  audience: NotificationAudience
  recipientId: number
  context: string
  type: string
}> {
  constructor(
    notificationId: number,
    audience: NotificationAudience,
    recipientId: number,
    context: string,
    type: string
  ) {
    super('notifications.issued', { notificationId, audience, recipientId, context, type })
  }
}
