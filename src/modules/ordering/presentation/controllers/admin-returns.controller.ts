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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  DecideReturnUseCase,
  ListReturnRequestsUseCase,
} from '../../application/use-cases/returns.use-cases'
import { OrderResponse } from '../dto/order.response'
import {
  ApproveReturnRequest,
  ListReturnRequestsQuery,
  PaginatedReturnRequestsResponse,
  RejectReturnRequest,
} from '../dto/returns.dto'

@ApiTags('Admin returns')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/returns')
export class AdminReturnsController {
  constructor(
    private readonly listReturnRequestsUseCase: ListReturnRequestsUseCase,
    private readonly decideReturnUseCase: DecideReturnUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Return requests, oldest first',
    description: 'Filter by status; REQUESTED is the queue waiting for a decision.',
  })
  @ApiOkResponse({ type: PaginatedReturnRequestsResponse })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED)
  list(@Query() query: ListReturnRequestsQuery) {
    return this.listReturnRequestsUseCase.execute(query)
  }

  @Post(':id/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve a return request',
    description: 'Texts the customer. Record the refund on the order once the money is sent.',
  })
  @ApiParam({ name: 'id', example: 3 })
  @ApiOkResponse({ type: OrderResponse, description: 'The order with its returns.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  approve(@Param('id', ParseIntPipe) id: number, @Body() body: ApproveReturnRequest) {
    return this.decideReturnUseCase.execute({
      returnRequestId: id,
      decision: 'approve',
      note: body.note,
    })
  }

  @Post(':id/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject a return request',
    description: 'The note is sent to the customer.',
  })
  @ApiParam({ name: 'id', example: 3 })
  @ApiOkResponse({ type: OrderResponse, description: 'The order with its returns.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  reject(@Param('id', ParseIntPipe) id: number, @Body() body: RejectReturnRequest) {
    return this.decideReturnUseCase.execute({
      returnRequestId: id,
      decision: 'reject',
      note: body.note,
    })
  }
}
