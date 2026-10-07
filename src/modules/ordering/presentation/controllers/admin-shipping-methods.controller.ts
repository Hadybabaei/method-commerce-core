import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  CreateShippingMethodUseCase,
  DeleteShippingMethodUseCase,
  ListShippingMethodsUseCase,
  UpdateShippingMethodUseCase,
} from '../../application/use-cases/shipping-methods.use-cases'
import {
  CreateShippingMethodRequest,
  UpdateShippingMethodRequest,
  toShippingMethodInput,
} from '../dto/shipping-method.request'
import { ShippingMethodResponse } from '../dto/shipping-method.response'

@ApiTags('Admin shipping')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin/shipping-methods')
export class AdminShippingMethodsController {
  constructor(
    private readonly listShippingMethodsUseCase: ListShippingMethodsUseCase,
    private readonly createShippingMethodUseCase: CreateShippingMethodUseCase,
    private readonly updateShippingMethodUseCase: UpdateShippingMethodUseCase,
    private readonly deleteShippingMethodUseCase: DeleteShippingMethodUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'List all shipping methods, active or not' })
  @ApiOkResponse({ type: [ShippingMethodResponse], description: 'By position, then id.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list() {
    return this.listShippingMethodsUseCase.execute()
  }

  @Post()
  @ApiOperation({
    summary: 'Create a shipping method',
    description:
      'Fee = base_fee + per_kg_fee × started kg, or 0 when the subtotal reaches free_above.',
  })
  @ApiCreatedResponse({ type: ShippingMethodResponse, description: 'The new method.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.CONFLICT)
  create(@Body() body: CreateShippingMethodRequest) {
    const input = toShippingMethodInput(body)
    return this.createShippingMethodUseCase.execute({
      ...input,
      name: body.name,
      code: body.code,
      baseFee: body.base_fee,
    })
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a shipping method',
    description: 'Only the sent fields change.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiOkResponse({ type: ShippingMethodResponse, description: 'The updated method.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateShippingMethodRequest) {
    return this.updateShippingMethodUseCase.execute({ id, ...toShippingMethodInput(body) })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete a shipping method',
    description:
      'Past orders keep their copy of the method. To stop offering it but keep it, set is_active=false.',
  })
  @ApiParam({ name: 'id', example: 1 })
  @ApiNoContentResponse({ description: 'The method was deleted.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.deleteShippingMethodUseCase.execute({ id })
  }
}
