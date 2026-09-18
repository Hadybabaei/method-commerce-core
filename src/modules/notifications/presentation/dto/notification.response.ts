import { ApiProperty } from '@nestjs/swagger'
import { PaginationMeta } from '@shared/presentation/swagger'
import { NotificationView } from '../../application/dto/views'
import {
  NOTIFICATION_AUDIENCES,
  NOTIFICATION_CONTEXTS,
  NotificationAudience,
  NotificationContext,
} from '../../domain/enums/notification.enums'

export class NotificationResponse implements NotificationView {
  @ApiProperty({ example: 12 })
  id: number

  @ApiProperty({ enum: NOTIFICATION_AUDIENCES, example: NotificationAudience.User })
  audience: NotificationAudience

  @ApiProperty({ example: 4 })
  recipientId: number

  @ApiProperty({ enum: NOTIFICATION_CONTEXTS, example: NotificationContext.Ordering })
  context: NotificationContext

  @ApiProperty({ example: 'order.created' })
  type: string

  @ApiProperty({ example: 'Order ORD-20260918-00001 placed' })
  title: string

  @ApiProperty({ example: 'We received your order and reserved the stock.' })
  body: string

  @ApiProperty({
    nullable: true,
    example: { orderId: 9, number: 'ORD-20260918-00001' },
  })
  data: Record<string, unknown> | null

  @ApiProperty({ nullable: true, example: null })
  readAt: Date | null

  @ApiProperty({ example: '2026-09-18T12:00:00.000Z' })
  createdAt: Date
}

export class PaginatedNotificationsResponse extends PaginationMeta {
  @ApiProperty({ type: [NotificationResponse] })
  items: NotificationResponse[]

  @ApiProperty({ example: 3, description: 'Unread rows for this inbox, ignoring filters.' })
  unreadCount: number
}

export class MarkAllReadResponse {
  @ApiProperty({ example: 4 })
  marked: number
}
