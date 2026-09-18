import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BasketNotFoundError } from '../../domain/errors/basket.errors'
import { Quantity } from '../../domain/value-objects/quantity.vo'
import { AdjustBasketItemCommand, BasketView } from '../dto/views'
import { BASKET_READ_MODEL, BasketReadModel } from '../ports/basket-read.port'
import { BasketWriter } from '../services/basket-writer.service'

@Injectable()
export class IncreaseBasketItemUseCase implements UseCase<AdjustBasketItemCommand, BasketView> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(command: AdjustBasketItemCommand): Promise<BasketView> {
    const by = Quantity.of(command.by ?? 1)

    await this.writer.mutate(command.userId, async (basket) => {
      basket.ensureOwnedBy(command.userId)
      const item = basket.findItem(command.variantId)
      const resulting = item.quantityVo.add(by).value
      await this.writer.requireSellable(command.variantId, resulting)
      basket.increase(command.variantId, by)
    })

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

@Injectable()
export class DecreaseBasketItemUseCase implements UseCase<AdjustBasketItemCommand, BasketView> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(command: AdjustBasketItemCommand): Promise<BasketView> {
    const by = Quantity.of(command.by ?? 1)

    await this.writer.mutate(command.userId, (basket) => {
      basket.ensureOwnedBy(command.userId)
      basket.decrease(command.variantId, by)
    })

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
