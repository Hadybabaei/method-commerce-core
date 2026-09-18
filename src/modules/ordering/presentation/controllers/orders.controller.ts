import {
  Body,
  Controller,
  Get,
  Headers,
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
  ApiHeader,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { CancelOrderUseCase } from '../../application/use-cases/cancel-order.use-case'
import { CreateOrderUseCase } from '../../application/use-cases/create-order.use-case'
import {
  GetOrderUseCase,
  ListOrdersUseCase,
} from '../../application/use-cases/get-list-orders.use-case'
import { InitiatePaymentUseCase } from '../../application/use-cases/initiate-payment.use-case'
import { PreviewCheckoutUseCase } from '../../application/use-cases/preview-checkout.use-case'
import { CreateOrderRequest, ListOrdersQueryRequest } from '../dto/order.request'
import { CheckoutPreviewResponse, OrderResponse } from '../dto/order.response'
import { PaymentResponse } from '../dto/payment.response'

@ApiTags('Orders')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(
    private readonly createOrderUseCase: CreateOrderUseCase,
    private readonly previewCheckoutUseCase: PreviewCheckoutUseCase,
    private readonly cancelOrderUseCase: CancelOrderUseCase,
    private readonly getOrderUseCase: GetOrderUseCase,
    private readonly listOrdersUseCase: ListOrdersUseCase,
    private readonly initiatePaymentUseCase: InitiatePaymentUseCase
  ) {}

  @Post()
  @ApiOperation({
    summary: 'Place an order from the basket',
    description:
      'Copies every basket line into a PENDING order, reserves stock, snapshots the address and prices, then clears the basket. Lines with stock or publish issues must be fixed first.',
  })
  @ApiCreatedResponse({ type: OrderResponse, description: 'The order was placed.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  create(@CurrentActor('id') userId: number, @Body() body: CreateOrderRequest) {
    return this.createOrderUseCase.execute({
      userId,
      addressId: body.address_id,
      paymentMethod: body.payment_method,
      note: body.note,
    })
  }

  @Post('preview')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Preview checkout totals from the basket',
    description:
      'Validates the basket and address the same way as placing an order, without reserving stock or creating a row. shipping_fee is currently 0.',
  })
  @ApiOkResponse({ type: CheckoutPreviewResponse, description: 'Checkout preview.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  preview(@CurrentActor('id') userId: number, @Body() body: CreateOrderRequest) {
    return this.previewCheckoutUseCase.execute({
      userId,
      addressId: body.address_id,
      paymentMethod: body.payment_method,
      note: body.note,
    })
  }

  @Get()
  @ApiOperation({
    summary: 'List the signed-in customer orders',
    description: 'Newest first. Filter by status and created date range.',
  })
  @ApiPaginatedResponse(OrderResponse, 'A page of the customer orders.')
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  list(@CurrentActor('id') userId: number, @Query() query: ListOrdersQueryRequest) {
    return this.listOrdersUseCase.execute({
      userId,
      status: query.status,
      search: query.search,
      createdFrom: query.created_from,
      createdTo: query.created_to,
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one of the signed-in customer orders' })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: OrderResponse, description: 'The order.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND
  )
  get(@CurrentActor('id') userId: number, @Param('id', ParseIntPipe) orderId: number) {
    return this.getOrderUseCase.execute({ orderId, userId })
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
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  cancel(@CurrentActor('id') userId: number, @Param('id', ParseIntPipe) orderId: number) {
    return this.cancelOrderUseCase.execute({ orderId, userId })
  }

  @Post(':id/payments')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Start an online payment for a pending order',
    description:
      'Requires header Idempotency-Key. Retries with the same key return the same payment intent; a different payload with that key conflicts.',
  })
  @ApiHeader({ name: 'Idempotency-Key', required: true, example: 'checkout-attempt-1' })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: PaymentResponse, description: 'Payment intent with redirect URL.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  initiatePayment(
    @CurrentActor('id') userId: number,
    @Param('id', ParseIntPipe) orderId: number,
    @Headers('idempotency-key') idempotencyKey: string | undefined
  ) {
    return this.initiatePaymentUseCase.execute({
      orderId,
      userId,
      idempotencyKey: idempotencyKey ?? '',
    })
  }
}
