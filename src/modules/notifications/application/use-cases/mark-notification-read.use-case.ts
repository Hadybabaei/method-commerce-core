import { Inject, Injectable } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { UseCase } from '@shared/application/use-case'
import { NotificationNotFoundError } from '../../domain/errors/notifications.errors'
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/repositories/notification.repository'
import { MarkAllNotificationsReadCommand, MarkNotificationReadCommand, NotificationView } from '../dto/views'
import { toNotificationView } from '../mappers/notification-view.mapper'

@Injectable()
export class MarkNotificationReadUseCase implements UseCase<
  MarkNotificationReadCommand,
  NotificationView
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute(command: MarkNotificationReadCommand): Promise<NotificationView> {
    const notification = await this.notifications.findById(command.notificationId)
    if (!notification || !notification.belongsTo(command.audience, command.recipientId)) {
      throw new NotificationNotFoundError(command.notificationId)
    }

    notification.markRead(this.clock.now())
    const saved = await this.notifications.save(notification)
    return toNotificationView(saved)
  }
}

@Injectable()
export class MarkAllNotificationsReadUseCase implements UseCase<
  MarkAllNotificationsReadCommand,
  { marked: number }
> {
  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async execute(command: MarkAllNotificationsReadCommand): Promise<{ marked: number }> {
    const marked = await this.notifications.markAllRead(
      command.audience,
      command.recipientId,
      this.clock.now()
    )
    return { marked }
  }
}
