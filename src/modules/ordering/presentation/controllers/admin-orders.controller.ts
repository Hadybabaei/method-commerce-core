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
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case'
import { CompleteOrderUseCase } from '../../application/use-cases/complete-order.use-case'
import { ConfirmCodPaymentUseCase } from '../../application/use-cases/confirm-cod-payment.use-case'
import {
  GetOrderUseCase,
  ListOrdersUseCase,
} from '../../application/use-cases/get-list-orders.use-case'
import { AdminListOrdersQueryRequest } from '../dto/order.request'
import { OrderResponse } from '../dto/order.response'

@ApiTags('Admin orders')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly confirmCodPaymentUseCase: ConfirmCodPaymentUseCase,
    private readonly completeOrderUseCase: CompleteOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List all orders',
    description: 'Filter by status, customer, order number and created date range.',
  })
  @ApiPaginatedResponse(OrderResponse, 'A page of orders.')
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  list(@Query() query: AdminListOrdersQueryRequest) {
    return this.listOrdersUseCase.execute({
      userId: query.user_id,
      status: query.status,
      search: query.search,
      createdFrom: query.created_from,
      createdTo: query.created_to,
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one order by id' })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The order.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  get(@Param('id', ParseIntPipe) orderId: number) {
    return this.getOrderUseCase.execute({ orderId })
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancel a pending order',
    description: 'Releases reserved stock. Only PENDING orders can be cancelled.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The cancelled order.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  cancel(@Param('id', ParseIntPipe) orderId: number) {
    return this.cancelOrderUseCase.execute({ orderId })
  }

  @Post(':id/confirm-payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Confirm a cash-on-delivery order',
    description:
      'Marks the order PAID and consumes reserved stock. Online orders are confirmed by the payment callback instead.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The paid order.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  confirmPayment(@Param('id', ParseIntPipe) orderId: number) {
    return this.confirmCodPaymentUseCase.execute({ orderId })
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark a paid order as delivered',
    description: 'Only PAID orders can be completed.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The completed order.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  complete(@Param('id', ParseIntPipe) orderId: number) {
    return this.completeOrderUseCase.execute({ orderId })
  }
}
