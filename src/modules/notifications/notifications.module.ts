import { Module } from '@nestjs/common'
import { IdentityModule } from '@modules/identity/identity.module'
import { ADMIN_RECIPIENT_DIRECTORY } from './application/ports/admin-recipient.port'
import { NOTIFICATIONS } from './application/ports/notifications.port'
import { ListNotificationsUseCase } from './application/use-cases/list-notifications.use-case'
import {
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from './application/use-cases/mark-notification-read.use-case'
import { SendNotificationUseCase } from './application/use-cases/send-notification.use-case'
import { NOTIFICATION_REPOSITORY } from './domain/repositories/notification.repository'
import { IdentityAdminRecipientDirectory } from './infrastructure/identity-admin-recipient.directory'
import { PrismaNotificationRepository } from './infrastructure/persistence/prisma-notification.repository'
import { AdminNotificationsController } from './presentation/controllers/admin-notifications.controller'
import { CustomerNotificationsController } from './presentation/controllers/customer-notifications.controller'

const useCases = [
  SendNotificationUseCase,
  ListNotificationsUseCase,
  MarkNotificationReadUseCase,
  MarkAllNotificationsReadUseCase,
]

/**
 * In-app inbox for customers and admins. Other contexts inject `NOTIFICATIONS`
 * and call `sendNotification({ context, type, recipients })`.
 */
@Module({
  imports: [IdentityModule],
  controllers: [CustomerNotificationsController, AdminNotificationsController],
  providers: [
    { provide: NOTIFICATION_REPOSITORY, useClass: PrismaNotificationRepository },
    { provide: ADMIN_RECIPIENT_DIRECTORY, useClass: IdentityAdminRecipientDirectory },
    { provide: NOTIFICATIONS, useExisting: SendNotificationUseCase },
    ...useCases,
  ],
  exports: [NOTIFICATIONS],
})
export class NotificationsModule {}
