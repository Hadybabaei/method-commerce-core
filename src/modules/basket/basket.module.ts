import { Module } from '@nestjs/common'
import { CatalogModule } from '@modules/catalog/catalog.module'
import { IdentityModule } from '@modules/identity/identity.module'
import { BASKET_READ_MODEL } from './application/ports/basket-read.port'
import { BasketWriter } from './application/services/basket-writer.service'
import {
  DecreaseBasketItemUseCase,
  IncreaseBasketItemUseCase,
} from './application/use-cases/adjust-basket-item.use-case'
import { AddBasketItemUseCase } from './application/use-cases/add-basket-item.use-case'
import {
  ClearBasketUseCase,
  GetBasketUseCase,
  RemoveBasketItemUseCase,
} from './application/use-cases/get-clear-remove-basket.use-case'
import { SetBasketItemQuantityUseCase } from './application/use-cases/set-basket-item-quantity.use-case'
import { BASKET_REPOSITORY } from './domain/repositories/basket.repository'
import { PrismaBasketReadModel } from './infrastructure/persistence/prisma-basket-read.model'
import { PrismaBasketRepository } from './infrastructure/persistence/prisma-basket.repository'
import { BasketController } from './presentation/controllers/basket.controller'

const useCases = [
  GetBasketUseCase,
  AddBasketItemUseCase,
  SetBasketItemQuantityUseCase,
  IncreaseBasketItemUseCase,
  DecreaseBasketItemUseCase,
  RemoveBasketItemUseCase,
  ClearBasketUseCase,
]

/**
 * Basket bounded context: the customer's open cart of product variants.
 * Orders will later be cut from this aggregate; payment is out of scope here.
 */
@Module({
  imports: [IdentityModule, CatalogModule],
  controllers: [BasketController],
  providers: [
    { provide: BASKET_REPOSITORY, useClass: PrismaBasketRepository },
    { provide: BASKET_READ_MODEL, useClass: PrismaBasketReadModel },
    BasketWriter,
    ...useCases,
  ],
  exports: [BASKET_REPOSITORY, BASKET_READ_MODEL],
})
export class BasketModule {}
