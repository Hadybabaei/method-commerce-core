import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BasketNotFoundError } from '../../domain/errors/basket.errors'
import { BasketUserCommand, BasketView, RemoveBasketItemCommand } from '../dto/views'
import { BASKET_READ_MODEL, BasketReadModel } from '../ports/basket-read.port'
import { BasketWriter } from '../services/basket-writer.service'

@Injectable()
export class RemoveBasketItemUseCase implements UseCase<RemoveBasketItemCommand, BasketView> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(command: RemoveBasketItemCommand): Promise<BasketView> {
    await this.writer.mutate(command.userId, (basket) => {
      basket.ensureOwnedBy(command.userId)
      basket.removeItem(command.variantId)
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
export class ClearBasketUseCase implements UseCase<BasketUserCommand, BasketView> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(command: BasketUserCommand): Promise<BasketView> {
    await this.writer.mutate(command.userId, (basket) => {
      basket.ensureOwnedBy(command.userId)
      basket.clear()
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
export class GetBasketUseCase implements UseCase<number, BasketView> {
  constructor(
    private readonly writer: BasketWriter,
    @Inject(BASKET_READ_MODEL) private readonly reads: BasketReadModel
  ) {}

  async execute(userId: number): Promise<BasketView> {
    await this.writer.getOrCreate(userId)
    const view = await this.reads.getByUserId(userId)
    if (!view) {
      throw new BasketNotFoundError(userId)
    }
    return view
  }
}
