import { NotificationAudience, notification } from '@prisma/client'
import { Notification } from '../../../domain/entities/notification.aggregate'
import {
  NotificationAudience as DomainAudience,
  NotificationContext as DomainContext,
} from '../../../domain/enums/notification.enums'

export function toDomainNotification(record: notification): Notification {
  return Notification.fromPersistence(record.id, {
    audience: record.audience as DomainAudience,
    recipientId: record.recipientId,
    context: record.context as DomainContext,
    type: record.type,
    title: record.title,
    body: record.body,
    data: asRecord(record.data),
    userId: record.userId,
    adminId: record.adminId,
    readAt: record.readAt,
    createdAt: record.created_at,
  })
}

export function toPrismaAudience(audience: DomainAudience): NotificationAudience {
  return audience as unknown as NotificationAudience
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) {
    return null
  }
  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return { value }
}
