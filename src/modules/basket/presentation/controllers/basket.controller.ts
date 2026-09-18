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
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  DecreaseBasketItemUseCase,
  IncreaseBasketItemUseCase,
} from '../../application/use-cases/adjust-basket-item.use-case'
import { AddBasketItemUseCase } from '../../application/use-cases/add-basket-item.use-case'
import {
  ClearBasketUseCase,
  GetBasketUseCase,
  RemoveBasketItemUseCase,
} from '../../application/use-cases/get-clear-remove-basket.use-case'
import { SetBasketItemQuantityUseCase } from '../../application/use-cases/set-basket-item-quantity.use-case'
import {
  AddBasketItemRequest,
  AdjustBasketItemRequest,
  SetBasketItemQuantityRequest,
} from '../dto/basket.request'
import { BasketResponse } from '../dto/basket.response'

/**
 * The signed-in customer's open cart. Lines are variants so a future order
 * can be cut from this basket without re-picking options.
 */
@ApiTags('Basket')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('users/me/basket')
export class BasketController {
  constructor(
    private readonly getBasketUseCase: GetBasketUseCase,
    private readonly addBasketItemUseCase: AddBasketItemUseCase,
    private readonly setBasketItemQuantityUseCase: SetBasketItemQuantityUseCase,
    private readonly increaseBasketItemUseCase: IncreaseBasketItemUseCase,
    private readonly decreaseBasketItemUseCase: DecreaseBasketItemUseCase,
    private readonly removeBasketItemUseCase: RemoveBasketItemUseCase,
    private readonly clearBasketUseCase: ClearBasketUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Get the signed-in customer basket',
    description:
      'Creates an empty basket on first visit. Line issues flag stock or publish problems.',
  })
  @ApiOkResponse({ type: BasketResponse, description: 'The current basket.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  get(@CurrentActor('id') userId: number) {
    return this.getBasketUseCase.execute(userId)
  }

  @Post('items')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Add a variant to the basket',
    description:
      'Merges into an existing line for the same variant. Stock is checked for the resulting quantity.',
  })
  @ApiOkResponse({ type: BasketResponse, description: 'The basket after the add.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  add(@CurrentActor('id') userId: number, @Body() body: AddBasketItemRequest) {
    return this.addBasketItemUseCase.execute({
      userId,
      variantId: body.variant_id,
      quantity: body.quantity,
    })
  }

  @Patch('items/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set the quantity of a basket line',
    description: 'Quantity 0 removes the line.',
  })
  @ApiParam({ name: 'variantId', example: 11 })
  @ApiOkResponse({ type: BasketResponse, description: 'The basket after the change.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  setQuantity(
    @CurrentActor('id') userId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: SetBasketItemQuantityRequest
  ) {
    return this.setBasketItemQuantityUseCase.execute({
      userId,
      variantId,
      quantity: body.quantity,
    })
  }

  @Post('items/:variantId/increase')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Increase a line quantity (default +1)' })
  @ApiParam({ name: 'variantId', example: 11 })
  @ApiOkResponse({ type: BasketResponse, description: 'The basket after the increase.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  increase(
    @CurrentActor('id') userId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: AdjustBasketItemRequest
  ) {
    return this.increaseBasketItemUseCase.execute({
      userId,
      variantId,
      by: body.by,
    })
  }

  @Post('items/:variantId/decrease')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Decrease a line quantity (default −1)',
    description: 'Removes the line when the quantity would reach zero.',
  })
  @ApiParam({ name: 'variantId', example: 11 })
  @ApiOkResponse({ type: BasketResponse, description: 'The basket after the decrease.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  decrease(
    @CurrentActor('id') userId: number,
    @Param('variantId', ParseIntPipe) variantId: number,
    @Body() body: AdjustBasketItemRequest
  ) {
    return this.decreaseBasketItemUseCase.execute({
      userId,
      variantId,
      by: body.by,
    })
  }

  @Delete('items/:variantId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remove one variant from the basket' })
  @ApiParam({ name: 'variantId', example: 11 })
  @ApiOkResponse({ type: BasketResponse, description: 'The basket after the removal.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  remove(@CurrentActor('id') userId: number, @Param('variantId', ParseIntPipe) variantId: number) {
    return this.removeBasketItemUseCase.execute({ userId, variantId })
  }

  @Delete()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Clear every line from the basket' })
  @ApiOkResponse({ type: BasketResponse, description: 'An empty basket.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  clear(@CurrentActor('id') userId: number) {
    return this.clearBasketUseCase.execute({ userId })
  }
}
