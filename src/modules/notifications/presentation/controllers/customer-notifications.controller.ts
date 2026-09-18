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
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
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

@ApiTags('Notifications')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('users/me/notifications')
export class CustomerNotificationsController {
  constructor(
    private readonly listNotifications: ListNotificationsUseCase,
    private readonly markRead: MarkNotificationReadUseCase,
    private readonly markAllRead: MarkAllNotificationsReadUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the signed-in customer notifications',
    description: 'Newest first. Filter by context or unread_only. unreadCount ignores the filter.',
  })
  @ApiOkResponse({ type: PaginatedNotificationsResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  list(@CurrentActor('id') userId: number, @Query() query: ListNotificationsQueryRequest) {
    return this.listNotifications.execute({
      audience: NotificationAudience.User,
      recipientId: userId,
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
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND
  )
  read(@CurrentActor('id') userId: number, @Param('id', ParseIntPipe) notificationId: number) {
    return this.markRead.execute({
      notificationId,
      audience: NotificationAudience.User,
      recipientId: userId,
    })
  }

  @Post('read-all')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark every unread notification as read' })
  @ApiOkResponse({ type: MarkAllReadResponse })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  readAll(@CurrentActor('id') userId: number) {
    return this.markAllRead.execute({
      audience: NotificationAudience.User,
      recipientId: userId,
    })
  }
}
