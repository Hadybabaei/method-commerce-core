import { Clock } from '@shared/application/ports/clock.port'
import { Notification } from '../../domain/entities/notification.aggregate'
import { NotificationAudience, NotificationContext } from '../../domain/enums/notification.enums'
import {
  NotificationListQuery,
  NotificationRepository,
} from '../../domain/repositories/notification.repository'
import { AdminRecipientDirectory } from '../ports/admin-recipient.port'
import { SendNotificationUseCase } from '../use-cases/send-notification.use-case'
import { ListNotificationsUseCase } from '../use-cases/list-notifications.use-case'
import {
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../use-cases/mark-notification-read.use-case'

export class FakeClock implements Clock {
  constructor(private current: Date = new Date('2026-09-18T12:00:00.000Z')) {}

  now(): Date {
    return this.current
  }

  secondsFromNow(seconds: number): Date {
    return new Date(this.current.getTime() + seconds * 1000)
  }
}

export class FixedAdminDirectory implements AdminRecipientDirectory {
  constructor(private ids: number[]) {}

  async listActiveIds(): Promise<number[]> {
    return [...this.ids]
  }
}

export class InMemoryNotificationRepository implements NotificationRepository {
  private nextId = 1
  readonly byId = new Map<number, Notification>()

  async save(notification: Notification): Promise<Notification> {
    if (notification.isNew) {
      const persisted = Notification.fromPersistence(this.nextId++, this.snapshot(notification))
      this.byId.set(persisted.id, persisted)
      return persisted
    }

    this.byId.set(notification.id, notification)
    return notification
  }

  async findById(id: number): Promise<Notification | null> {
    return this.byId.get(id) ?? null
  }

  async list(query: NotificationListQuery): Promise<{ items: Notification[]; total: number }> {
    const filtered = this.matching(query.audience, query.recipientId, query.context, query.unreadOnly)
    const items = filtered.slice(query.offset, query.offset + query.limit)
    return { items, total: filtered.length }
  }

  async countUnread(audience: NotificationAudience, recipientId: number): Promise<number> {
    return this.matching(audience, recipientId, undefined, true).length
  }

  async markAllRead(
    audience: NotificationAudience,
    recipientId: number,
    now: Date
  ): Promise<number> {
    let marked = 0
    for (const notification of this.byId.values()) {
      if (notification.belongsTo(audience, recipientId) && !notification.isRead) {
        notification.markRead(now)
        marked += 1
      }
    }
    return marked
  }

  private matching(
    audience: NotificationAudience,
    recipientId: number,
    context?: NotificationContext,
    unreadOnly?: boolean
  ): Notification[] {
    return [...this.byId.values()]
      .filter((notification) => notification.belongsTo(audience, recipientId))
      .filter((notification) => (context ? notification.context === context : true))
      .filter((notification) => (unreadOnly ? !notification.isRead : true))
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  }

  private snapshot(notification: Notification) {
    return {
      audience: notification.audience,
      recipientId: notification.recipientId,
      context: notification.context,
      type: notification.type,
      title: notification.title,
      body: notification.body,
      data: notification.data,
      userId: notification.userId,
      adminId: notification.adminId,
      readAt: notification.readAt,
      createdAt: notification.createdAt,
    }
  }
}

export function createNotificationsHarness(adminIds: number[] = [7, 8]) {
  const clock = new FakeClock()
  const store = new InMemoryNotificationRepository()
  const admins = new FixedAdminDirectory(adminIds)
  const send = new SendNotificationUseCase(store, admins, clock)
  const list = new ListNotificationsUseCase(store)
  const markRead = new MarkNotificationReadUseCase(store, clock)
  const markAll = new MarkAllNotificationsReadUseCase(store, clock)

  return { clock, store, admins, send, list, markRead, markAll }
}
