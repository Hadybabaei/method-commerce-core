import { NotificationContext } from '../../domain/enums/notification.enums'

/**
 * Who should receive a copy. Title/body on a recipient override the command
 * defaults so the customer and admin inboxes can say different things.
 */
export type NotificationRecipient =
  | {
      audience: 'user'
      userId: number
      title?: string
      body?: string
    }
  | {
      audience: 'admin'
      adminId: number
      title?: string
      body?: string
    }
  | {
      audience: 'admin'
      allAdmins: true
      title?: string
      body?: string
    }

export interface SendNotificationCommand {
  context: NotificationContext
  type: string
  title: string
  body: string
  data?: Record<string, unknown>
  recipients: NotificationRecipient[]
}

/**
 * Port other bounded contexts inject. Call `sendNotification` after a
 * successful write; failures are logged and do not roll back the caller.
 */
export interface Notifications {
  sendNotification(command: SendNotificationCommand): Promise<void>
}

export const NOTIFICATIONS = Symbol('Notifications')
