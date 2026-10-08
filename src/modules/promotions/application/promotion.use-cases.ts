import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { BusinessRuleViolationError, NotFoundError } from '@shared/domain/errors'
import { Promotion, PromotionInput, PromotionKind } from '../domain/promotion.entity'
import { PROMOTION_REPOSITORY, PromotionRepository } from './promotion.ports'

export interface PromotionView {
  id: number
  name: string
  /** null for automatic campaigns. */
  code: string | null
  kind: PromotionKind
  value: number
  maxDiscount: number | null
  minSubtotal: number | null
  startsAt: Date
  endsAt: Date | null
  usageLimit: number | null
  perCustomerLimit: number | null
  categoryIds: number[] | null
  brandIds: number[] | null
  isActive: boolean
  usedCount: number
}

export function toPromotionView(promotion: Promotion): PromotionView {
  return {
    id: promotion.id,
    name: promotion.name,
    code: promotion.code,
    kind: promotion.kind,
    value: promotion.value,
    maxDiscount: promotion.maxDiscount,
    minSubtotal: promotion.minSubtotal,
    startsAt: promotion.startsAt,
    endsAt: promotion.endsAt,
    usageLimit: promotion.usageLimit,
    perCustomerLimit: promotion.perCustomerLimit,
    categoryIds: promotion.categoryIds,
    brandIds: promotion.brandIds,
    isActive: promotion.isActive,
    usedCount: promotion.usedCount,
  }
}

class PromotionNotFoundError extends NotFoundError {
  constructor(id: number) {
    super('Promotion not found', { promotion: id })
  }
}

@Injectable()
export class ListPromotionsUseCase implements UseCase<void, PromotionView[]> {
  constructor(@Inject(PROMOTION_REPOSITORY) private readonly promotions: PromotionRepository) {}

  async execute(): Promise<PromotionView[]> {
    return (await this.promotions.list()).map(toPromotionView)
  }
}

@Injectable()
export class CreatePromotionUseCase implements UseCase<PromotionInput, PromotionView> {
  constructor(@Inject(PROMOTION_REPOSITORY) private readonly promotions: PromotionRepository) {}

  async execute(input: PromotionInput): Promise<PromotionView> {
    return toPromotionView(await this.promotions.save(Promotion.create(input)))
  }
}

@Injectable()
export class UpdatePromotionUseCase implements UseCase<
  { id: number } & Partial<PromotionInput>,
  PromotionView
> {
  constructor(@Inject(PROMOTION_REPOSITORY) private readonly promotions: PromotionRepository) {}

  async execute({ id, ...changes }: { id: number } & Partial<PromotionInput>) {
    const promotion = await this.promotions.findById(id)
    if (!promotion) throw new PromotionNotFoundError(id)
    promotion.update(changes)
    return toPromotionView(await this.promotions.save(promotion))
  }
}

/** Used promotions stay for the orders that reference them; deactivate those instead. */
@Injectable()
export class DeletePromotionUseCase implements UseCase<{ id: number }, void> {
  constructor(@Inject(PROMOTION_REPOSITORY) private readonly promotions: PromotionRepository) {}

  async execute({ id }: { id: number }): Promise<void> {
    const promotion = await this.promotions.findById(id)
    if (!promotion) throw new PromotionNotFoundError(id)
    if (promotion.usedCount > 0) {
      throw new BusinessRuleViolationError(
        'This promotion has been used; deactivate it instead of deleting',
        { usedCount: promotion.usedCount }
      )
    }
    await this.promotions.delete(id)
  }
}
