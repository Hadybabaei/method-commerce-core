import { Inject, Injectable } from '@nestjs/common'
import { Prisma } from '@prisma/client'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Notification } from '../../domain/entities/notification.aggregate'
import { NotificationAudience, NotificationContext } from '../../domain/enums/notification.enums'
import {
  NotificationListQuery,
  NotificationRepository,
} from '../../domain/repositories/notification.repository'
import { toDomainNotification, toPrismaAudience } from './mappers/notification.mapper'

@Injectable()
export class PrismaNotificationRepository implements NotificationRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async save(notification: Notification): Promise<Notification> {
    if (notification.isNew) {
      const record = await this.prisma.notification.create({
        data: {
          audience: toPrismaAudience(notification.audience),
          recipientId: notification.recipientId,
          context: notification.context,
          type: notification.type,
          title: notification.title,
          body: notification.body,
          data: (notification.data ?? undefined) as Prisma.InputJsonValue | undefined,
          userId: notification.userId,
          adminId: notification.adminId,
          created_at: notification.createdAt,
        },
      })
      const persisted = toDomainNotification(record)
      persisted.markIssued()
      await this.events.publish(persisted.pullDomainEvents())
      return persisted
    }

    const record = await this.prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: notification.readAt },
    })
    return toDomainNotification(record)
  }

  async findById(id: number): Promise<Notification | null> {
    const record = await this.prisma.notification.findUnique({ where: { id } })
    return record ? toDomainNotification(record) : null
  }

  async list(query: NotificationListQuery): Promise<{ items: Notification[]; total: number }> {
    const where = this.whereInbox(query.audience, query.recipientId, query.context, query.unreadOnly)

    const [records, total] = await this.prisma.$transaction([
      this.prisma.notification.findMany({
        where,
        orderBy: { created_at: 'desc' },
        take: query.limit,
        skip: query.offset,
      }),
      this.prisma.notification.count({ where }),
    ])

    return { items: records.map(toDomainNotification), total }
  }

  countUnread(audience: NotificationAudience, recipientId: number): Promise<number> {
    return this.prisma.notification.count({
      where: this.whereInbox(audience, recipientId, undefined, true),
    })
  }

  async markAllRead(
    audience: NotificationAudience,
    recipientId: number,
    now: Date
  ): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: this.whereInbox(audience, recipientId, undefined, true),
      data: { readAt: now },
    })
    return result.count
  }

  private whereInbox(
    audience: NotificationAudience,
    recipientId: number,
    context?: NotificationContext,
    unreadOnly?: boolean
  ): Prisma.notificationWhereInput {
    return {
      audience: toPrismaAudience(audience),
      recipientId,
      ...(context ? { context } : {}),
      ...(unreadOnly ? { readAt: null } : {}),
    }
  }
}
