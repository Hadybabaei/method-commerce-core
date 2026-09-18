import { Notification } from '../../domain/entities/notification.aggregate'
import { NotificationView } from '../dto/views'

export function toNotificationView(notification: Notification): NotificationView {
  return {
    id: notification.id,
    audience: notification.audience,
    recipientId: notification.recipientId,
    context: notification.context,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    data: notification.data,
    readAt: notification.readAt,
    createdAt: notification.createdAt,
  }
}
