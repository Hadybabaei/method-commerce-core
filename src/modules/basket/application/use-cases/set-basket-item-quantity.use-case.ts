import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BasketNotFoundError } from '../../domain/errors/basket.errors'
import { Quantity } from '../../domain/value-objects/quantity.vo'
import { BasketView, ChangeBasketItemQuantityCommand } from '../dto/views'
import { BASKET_READ_MODEL, BasketReadModel } from '../ports/basket-read.port'
import { BasketWriter } from '../services/basket-writer.service'

@Injectable()
export class SetBasketItemQuantityUseCase implements UseCase<
  ChangeBasketItemQuantityCommand,
  BasketView
> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(command: ChangeBasketItemQuantityCommand): Promise<BasketView> {
    const quantity = Quantity.of(command.quantity)

    await this.writer.mutate(command.userId, async (basket) => {
      basket.ensureOwnedBy(command.userId)
      if (!quantity.isZero) {
        await this.writer.requireSellable(command.variantId, quantity.value)
      }
      basket.setQuantity(command.variantId, quantity)
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
