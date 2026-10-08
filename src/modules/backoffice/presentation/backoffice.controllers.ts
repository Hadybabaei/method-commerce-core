import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { CLOCK, Clock } from '@shared/application/ports/clock.port'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { RequirePermission } from '@shared/presentation/decorators/require-permission.decorator'
import {
  AUDIT_LOG,
  AuditLog,
  CUSTOMERS_SERVICE,
  CustomersService,
  DateRange,
  REPORTS_READ_MODEL,
  ReportsReadModel,
  STOCK_SERVICE,
  StockService,
} from '../application/backoffice.ports'
import {
  AdjustStockRequest,
  AuditQuery,
  CustomersQuery,
  DateRangeQuery,
  StockQuery,
  StockThresholdRequest,
  TopProductsQuery,
} from './backoffice.dto'

const DAY_MS = 24 * 60 * 60 * 1000

function rangeOf(query: DateRangeQuery, now: Date): DateRange {
  const to = query.to ?? now
  return { from: query.from ?? new Date(to.getTime() - 30 * DAY_MS), to }
}

@ApiTags('Admin reports')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('reports')
@Controller('admin/reports')
export class AdminReportsController {
  constructor(
    @Inject(REPORTS_READ_MODEL) private readonly reports: ReportsReadModel,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  @Get('dashboard')
  @ApiOperation({
    summary: 'Today and this month at a glance',
    description:
      'Sales are paid, non-cancelled orders (total minus refunds) on Tehran calendar days.',
  })
  dashboard() {
    return this.reports.dashboard(this.clock.now())
  }

  @Get('sales')
  @ApiOperation({ summary: 'Sales and order count per Tehran day (default: last 30 days)' })
  sales(@Query() query: DateRangeQuery) {
    return this.reports.salesByDay(rangeOf(query, this.clock.now()))
  }

  @Get('top-products')
  @ApiOperation({ summary: 'Best-selling products by revenue (after discount, before VAT)' })
  topProducts(@Query() query: TopProductsQuery) {
    return this.reports.topProducts(rangeOf(query, this.clock.now()), query.limit ?? 10)
  }

  @Get('categories')
  @ApiOperation({ summary: 'Revenue by product category' })
  categories(@Query() query: DateRangeQuery) {
    return this.reports.salesByCategory(rangeOf(query, this.clock.now()))
  }

  @Get('payment-conversion')
  @ApiOperation({ summary: 'Share of online orders that got paid' })
  conversion(@Query() query: DateRangeQuery) {
    return this.reports.paymentConversion(rangeOf(query, this.clock.now()))
  }

  @Get('orders.csv')
  @ApiOperation({ summary: 'Orders placed in the range as CSV (money in Rial)' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async ordersCsv(@Query() query: DateRangeQuery) {
    return this.reports.ordersCsv(rangeOf(query, this.clock.now()))
  }

  @Get('products.csv')
  @ApiOperation({ summary: 'Every variant with prices and stock as CSV (money in Rial)' })
  @ApiProduces('text/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  productsCsv() {
    return this.reports.productsCsv()
  }
}

@ApiTags('Admin customers')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('customers')
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(
    @Inject(CUSTOMERS_SERVICE) private readonly customers: CustomersService,
    @Inject(CLOCK) private readonly clock: Clock
  ) {}

  @Get()
  @ApiOperation({ summary: 'Customers, newest first, with order count and total spent' })
  list(@Query() query: CustomersQuery) {
    return this.customers.list({
      search: query.search,
      limit: query.limit ?? 20,
      offset: query.offset ?? 0,
    })
  }

  @Get(':id')
  @ApiOperation({ summary: 'One customer with recent orders' })
  get(@Param('id', ParseIntPipe) id: number) {
    return this.customers.get(id)
  }

  @Post(':id/block')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Block a customer',
    description: 'They are signed out and cannot sign in or order until unblocked.',
  })
  block(@Param('id', ParseIntPipe) id: number) {
    return this.customers.setBlocked(id, true, this.clock.now())
  }

  @Post(':id/unblock')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Unblock a customer' })
  unblock(@Param('id', ParseIntPipe) id: number) {
    return this.customers.setBlocked(id, false, this.clock.now())
  }
}

@ApiTags('Admin stock')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('stock')
@Controller('admin/stock')
export class AdminStockController {
  constructor(@Inject(STOCK_SERVICE) private readonly stock: StockService) {}

  @Get()
  @ApiOperation({ summary: 'Stock per variant and warehouse; low_only lists alerts' })
  list(@Query() query: StockQuery) {
    return this.stock.list({
      search: query.search,
      lowOnly: query.low_only,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    })
  }

  @Post(':variantId/adjust')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add or remove units with a reason',
    description: 'Refused when it would leave fewer units than open orders have reserved.',
  })
  adjust(
    @CurrentActor('id') adminId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: AdjustStockRequest
  ) {
    return this.stock.adjust({
      variantId,
      locationId: body.location_id,
      delta: body.delta,
      reason: body.reason,
      adminId,
    })
  }

  @Put(':variantId/threshold')
  @ApiOperation({ summary: 'Set the low-stock alert level (null = off)' })
  threshold(
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: StockThresholdRequest
  ) {
    return this.stock.setThreshold(variantId, body.low_stock_threshold)
  }

  @Get(':variantId/movements')
  @ApiOperation({ summary: 'Latest manual adjustments of a variant' })
  movements(@Param('variantId', ParseIntPipe) variantId: number) {
    return this.stock.movements(variantId, 50)
  }
}

@ApiTags('Admin audit log')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('admins')
@Controller('admin/audit-log')
export class AdminAuditLogController {
  constructor(@Inject(AUDIT_LOG) private readonly audit: AuditLog) {}

  @Get()
  @ApiOperation({ summary: 'Back-office changes, newest first' })
  list(@Query() query: AuditQuery) {
    return this.audit.list({
      adminId: query.admin_id,
      entity: query.entity,
      entityId: query.entity_id,
      limit: query.limit ?? 50,
      offset: query.offset ?? 0,
    })
  }
}
