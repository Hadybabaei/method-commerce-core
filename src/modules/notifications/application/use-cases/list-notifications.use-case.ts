import { Inject, Injectable } from '@nestjs/common'
import { InvalidInputError } from '@shared/domain/errors'
import { UseCase } from '@shared/application/use-case'
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/repositories/notification.repository'
import { ListNotificationsQuery, PaginatedNotificationsView } from '../dto/views'
import { toNotificationView } from '../mappers/notification-view.mapper'

const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

@Injectable()
export class ListNotificationsUseCase implements UseCase<
  ListNotificationsQuery,
  PaginatedNotificationsView
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository
  ) {}

  async execute(query: ListNotificationsQuery): Promise<PaginatedNotificationsView> {
    const limit = clampLimit(query.limit)
    const offset = clampOffset(query.offset)

    const [{ items, total }, unreadCount] = await Promise.all([
      this.notifications.list({
        audience: query.audience,
        recipientId: query.recipientId,
        context: query.context,
        unreadOnly: query.unreadOnly,
        limit,
        offset,
      }),
      this.notifications.countUnread(query.audience, query.recipientId),
    ])

    return {
      items: items.map(toNotificationView),
      total,
      unreadCount,
      limit,
      offset,
    }
  }
}

function clampLimit(limit?: number): number {
  if (limit === undefined) {
    return DEFAULT_LIMIT
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new InvalidInputError('limit must be a positive integer')
  }
  return Math.min(limit, MAX_LIMIT)
}

function clampOffset(offset?: number): number {
  if (offset === undefined) {
    return 0
  }
  if (!Number.isInteger(offset) || offset < 0) {
    throw new InvalidInputError('offset must be a non-negative integer')
  }
  return offset
}
