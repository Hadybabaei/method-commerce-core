import { Notification } from '../entities/notification.aggregate'
import { NotificationAudience, NotificationContext } from '../enums/notification.enums'

export interface NotificationListQuery {
  audience: NotificationAudience
  recipientId: number
  context?: NotificationContext
  unreadOnly?: boolean
  limit: number
  offset: number
}

export interface NotificationRepository {
  save(notification: Notification): Promise<Notification>

  findById(id: number): Promise<Notification | null>

  list(query: NotificationListQuery): Promise<{ items: Notification[]; total: number }>

  countUnread(audience: NotificationAudience, recipientId: number): Promise<number>

  markAllRead(audience: NotificationAudience, recipientId: number, now: Date): Promise<number>
}

export const NOTIFICATION_REPOSITORY = Symbol('NotificationRepository')
