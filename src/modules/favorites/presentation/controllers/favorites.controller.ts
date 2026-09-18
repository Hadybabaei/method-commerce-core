import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
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
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { AddFavoriteUseCase } from '../../application/use-cases/add-favorite.use-case'
import { ListFavoritesUseCase } from '../../application/use-cases/list-favorites.use-case'
import { RemoveFavoriteUseCase } from '../../application/use-cases/remove-favorite.use-case'
import { AddFavoriteRequest } from '../dto/favorite.request'
import { FavoriteResponse } from '../dto/favorite.response'

/**
 * Wishlist for the signed-in customer. The owner always comes from the access
 * token; the path and body only name the product.
 */
@ApiTags('Favorites')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('users/me/favorites')
export class FavoritesController {
  constructor(
    private readonly addFavoriteUseCase: AddFavoriteUseCase,
    private readonly removeFavoriteUseCase: RemoveFavoriteUseCase,
    private readonly listFavoritesUseCase: ListFavoritesUseCase
  ) {}

  @Get()
  @ApiOperation({
    summary: 'List the signed-in customer favorites',
    description: 'Newest first. Products that have since been unpublished are omitted.',
  })
  @ApiOkResponse({ type: [FavoriteResponse], description: 'Saved products, newest first.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list(@CurrentActor('id') userId: number) {
    return this.listFavoritesUseCase.execute(userId)
  }

  @Post()
  @ApiOperation({
    summary: 'Save a product to favorites',
    description: 'Only published products can be saved. Adding the same product twice returns 409.',
  })
  @ApiCreatedResponse({ type: FavoriteResponse, description: 'The product was saved.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  add(@CurrentActor('id') userId: number, @Body() body: AddFavoriteRequest) {
    return this.addFavoriteUseCase.execute({
      userId,
      productId: body.product_id,
    })
  }

  @Delete(':productId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove a product from favorites',
    description: 'The path parameter is the product id, not the favorite row id.',
  })
  @ApiParam({ name: 'productId', example: 1 })
  @ApiNoContentResponse({ description: 'The product was removed from favorites.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND
  )
  async remove(
    @CurrentActor('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number
  ): Promise<void> {
    await this.removeFavoriteUseCase.execute({ userId, productId })
  }
}
