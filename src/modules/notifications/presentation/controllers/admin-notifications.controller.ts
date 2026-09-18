import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { NotificationAudience } from '../../domain/enums/notification.enums'
import { ListNotificationsUseCase } from '../../application/use-cases/list-notifications.use-case'
import {
  MarkAllNotificationsReadUseCase,
  MarkNotificationReadUseCase,
} from '../../application/use-cases/mark-notification-read.use-case'
import { ListNotificationsQueryRequest } from '../dto/notification.request'
import {
  MarkAllReadResponse,
  NotificationResponse,
  PaginatedNotificationsResponse,
} from '../dto/notification.response'

@ApiTags('Admin notifications')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/notifications')
export class AdminNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markRead: MarkNotificationReadUseCase,
    private readonly markAllRead: MarkAllNotificationsReadUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the signed-in admin notifications',
    description: 'Newest first. Filter by context or unread_only. unreadCount ignores the filter.',
  })
  @ApiOkResponse({ type: PaginatedNotificationsResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  list(@CurrentActor('id') adminId: number, @Query() query: ListNotificationsQueryRequest) {
    return this.listNotifications.execute({
      audience: NotificationAudience.Admin,
      recipientId: adminId,
      context: query.context,
      unreadOnly: query.unread_only,
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark one notification as read' })
  @ApiParam({ name: 'id', example: 12 })
  @ApiOkResponse({ type: NotificationResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  read(@CurrentActor('id') adminId: number, @Param('id', ParseIntPipe) notificationId: number) {
    return this.markRead.execute({
      notificationId,
      audience: NotificationAudience.Admin,
      recipientId: adminId,
    })
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  @ApiOkResponse({ type: MarkAllReadResponse })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  readAll(@CurrentActor('id') adminId: number) {
    return this.markAllRead.execute({
      audience: NotificationAudience.Admin,
      recipientId: adminId,
    })
  }
}
