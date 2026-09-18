import { NotificationAudience, NotificationContext } from '../../domain/enums/notification.enums'

export interface NotificationView {
  id: number
  audience: NotificationAudience
  recipientId: number
  context: NotificationContext
  type: string
  title: string
  body: string
  data: Record<string, unknown> | null
  readAt: Date | null
  createdAt: Date
}

export interface PaginatedNotificationsView {
  items: NotificationView[]
  total: number
  unreadCount: number
  limit: number
  offset: number
}

export interface ListNotificationsQuery {
  audience: NotificationAudience
  recipientId: number
  context?: NotificationContext
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

export interface MarkNotificationReadCommand {
  notificationId: number
  audience: NotificationAudience
  recipientId: number
}

export interface MarkAllNotificationsReadCommand {
  audience: NotificationAudience
  recipientId: number
}
