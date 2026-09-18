import { Inject, Injectable, Logger } from '@nestjs/common'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { InvalidInputError } from '@shared/domain/errors'
import { Notification } from '../../domain/entities/notification.aggregate'
import { NotificationAudience, NotificationContext } from '../../domain/enums/notification.enums'
import {
  NOTIFICATION_REPOSITORY,
  NotificationRepository,
} from '../../domain/repositories/notification.repository'
import {
  ADMIN_RECIPIENT_DIRECTORY,
  AdminRecipientDirectory,
} from '../ports/admin-recipient.port'
import {
  NotificationRecipient,
  Notifications,
  SendNotificationCommand,
} from '../ports/notifications.port'

/**
 * Persists one inbox row per resolved recipient. Other modules should inject
 * `NOTIFICATIONS` and call this; a persistence failure is logged, not thrown.
 */
@Injectable()
export class SendNotificationUseCase implements Notifications {
  private readonly logger = new Logger(SendNotificationUseCase.name)

  constructor(
    @Inject(NOTIFICATION_REPOSITORY) private readonly notifications: NotificationRepository,
    @Inject(ADMIN_RECIPIENT_DIRECTORY) private readonly admins: AdminRecipientDirectory,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  async sendNotification(command: SendNotificationCommand): Promise<void> {
    try {
      await this.dispatch(command)
    } catch (error) {
      this.logger.error(
        `Failed to send ${command.context}.${command.type}`,
        error instanceof Error ? error.stack : undefined
      )
    }
  }

  private async dispatch(command: SendNotificationCommand): Promise<void> {
    if (!Object.values(NotificationContext).includes(command.context)) {
      throw new InvalidInputError('Unknown notification context', { context: command.context })
    }
    if (!Array.isArray(command.recipients) || command.recipients.length === 0) {
      throw new InvalidInputError('A notification needs at least one recipient')
    }

    const now = this.clock.now()
    const targets = await this.resolveRecipients(command)

    for (const target of targets) {
      const notification = Notification.create({
        audience: target.audience,
        recipientId: target.recipientId,
        context: command.context,
        type: command.type,
        title: target.title,
        body: target.body,
        data: command.data,
        now,
      })

      try {
        await this.notifications.save(notification)
      } catch (error) {
        this.logger.warn(
          `Skipped ${command.context}.${command.type} for ${target.audience}:${target.recipientId}: ${
            error instanceof Error ? error.message : String(error)
          }`
        )
      }
    }
  }

  private async resolveRecipients(command: SendNotificationCommand): Promise<
    Array<{
      audience: NotificationAudience
      recipientId: number
      title: string
      body: string
    }>
  > {
    const resolved: Array<{
      audience: NotificationAudience
      recipientId: number
      title: string
      body: string
    }> = []
    const seen = new Set<string>()

    for (const recipient of command.recipients) {
      const title = recipient.title?.trim() || command.title
      const body = recipient.body?.trim() || command.body

      for (const recipientId of await this.recipientIds(recipient)) {
        const key = `${recipient.audience}:${recipientId}`
        if (seen.has(key)) {
          continue
        }
        seen.add(key)
        resolved.push({
          audience:
            recipient.audience === 'user' ? NotificationAudience.User : NotificationAudience.Admin,
          recipientId,
          title,
          body,
        })
      }
    }

    return resolved
  }

  private async recipientIds(recipient: NotificationRecipient): Promise<number[]> {
    if (recipient.audience === 'user') {
      return [recipient.userId]
    }
    if ('allAdmins' in recipient && recipient.allAdmins) {
      return this.admins.listActiveIds()
    }
    if ('adminId' in recipient) {
      return [recipient.adminId]
    }
    return []
  }
}
