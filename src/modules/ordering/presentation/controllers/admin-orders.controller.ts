import { RequirePermission } from '@shared/presentation/decorators/require-permission.decorator'
import { RecordRefundUseCase } from '../../application/use-cases/returns.use-cases'
import { RecordRefundRequest } from '../dto/returns.dto'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { GetInvoiceUseCase } from '../../application/use-cases/get-invoice.use-case'
import { InvoiceResponse } from '../dto/invoice.response'
import {
  Body,
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
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case'
import { CompleteOrderUseCase } from '../../application/use-cases/complete-order.use-case'
import { ConfirmCodPaymentUseCase } from '../../application/use-cases/confirm-cod-payment.use-case'
import {
  GetOrderUseCase,
  ListOrdersUseCase,
} from '../../application/use-cases/get-list-orders.use-case'
import { ProcessOrderUseCase } from '../../application/use-cases/process-order.use-case'
import { ShipOrderUseCase } from '../../application/use-cases/ship-order.use-case'
import { AdminListOrdersQueryRequest, ShipOrderRequest } from '../dto/order.request'
import { OrderResponse } from '../dto/order.response'

@ApiTags('Admin orders')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('orders')
@Controller('admin/orders')
export class AdminOrdersController {
  constructor(
    private readonly recordRefundUseCase: RecordRefundUseCase,
    private readonly getInvoiceUseCase: GetInvoiceUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly confirmCodPaymentUseCase: ConfirmCodPaymentUseCase,
    private readonly completeOrderUseCase: CompleteOrderUseCase,
    private readonly processOrderUseCase: ProcessOrderUseCase,
    private readonly shipOrderUseCase: ShipOrderUseCase,
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

  @Get(':id/invoice')
  @ApiOperation({
    summary: 'Sales invoice for a paid order',
    description: 'Seller and buyer details, lines with VAT and totals in Rial. 422 before payment.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: InvoiceResponse })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  invoice(@Param('id', ParseIntPipe) orderId: number) {
    return this.getInvoiceUseCase.execute({ orderId })
  }

  @Post(':id/refunds')
  @RequirePermission('refunds')
  @ApiOperation({
    summary: 'Record a refund paid by bank transfer',
    description:
      'Pay the customer outside the system first, then record the amount and transfer reference. Refunds cannot add up to more than the order total. With return_request_id the approved return becomes REFUNDED; restock puts its units back on hand.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiCreatedResponse({ type: OrderResponse, description: 'The order with the refund.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  recordRefund(
    @CurrentActor('id') adminId: number,
    @Param('id', ParseIntPipe) orderId: number,
    @Body() body: RecordRefundRequest
  ) {
    return this.recordRefundUseCase.execute({
      orderId,
      adminId,
      amount: body.amount,
      reference: body.reference,
      paidAt: body.paid_at,
      note: body.note,
      returnRequestId: body.return_request_id,
      restock: body.restock,
    })
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

  @Post(':id/process')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start preparing a paid order',
    description: 'PAID → PROCESSING. Texts the customer. Repeating it is a no-op.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The processing order.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  process(@Param('id', ParseIntPipe) orderId: number) {
    return this.processOrderUseCase.execute({ orderId })
  }

  @Post(':id/ship')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Hand a paid or processing order to the carrier',
    description:
      "PAID or PROCESSING → SHIPPED with an optional tracking code. Without tracking_url, the shipping method's template builds one. On a SHIPPED order this only corrects the tracking details.",
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The shipped order.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  ship(@Param('id', ParseIntPipe) orderId: number, @Body() body: ShipOrderRequest) {
    return this.shipOrderUseCase.execute({
      orderId,
      trackingCode: body.tracking_code,
      trackingUrl: body.tracking_url,
    })
  }

  @Post(':id/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Mark an order as delivered',
    description: 'PAID, PROCESSING or SHIPPED → COMPLETED.',
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
