import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { Quantity } from '../../domain/value-objects/quantity.vo'
import { BASKET_REPOSITORY, BasketRepository } from '../../domain/repositories/basket.repository'
import { AddBasketItemCommand, BasketView } from '../dto/views'
import { BASKET_READ_MODEL, BasketReadModel } from '../ports/basket-read.port'
import { BasketWriter } from '../services/basket-writer.service'
import { BasketNotFoundError } from '../../domain/errors/basket.errors'

@Injectable()
export class AddBasketItemUseCase implements UseCase<AddBasketItemCommand, BasketView> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_REPOSITORY) private readonly baskets: BasketRepository,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(command: AddBasketItemCommand): Promise<BasketView> {
    const quantity = Quantity.of(command.quantity)
    const basket = await this.writer.getOrCreate(command.userId)
    basket.ensureOwnedBy(command.userId)

    const existing = basket.tryFindItem(command.variantId)
    const resulting = existing ? existing.quantityVo.add(quantity).value : quantity.value

    await this.writer.requireSellable(command.variantId, resulting)

    basket.addItem(command.variantId, quantity)
    await this.baskets.save(basket)

    return this.requireView(command.userId)
  }

  private async requireView(userId: number): Promise<BasketView> {
    const view = await this.reads.getByUserId(userId)
    if (!view) {
      throw new BasketNotFoundError(userId)
    }
    return view
  }
}
