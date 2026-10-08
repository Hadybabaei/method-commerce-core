import { Inject, Injectable } from '@nestjs/common'
import { CouponNotApplicableError, Promotion, PromotionDiscount } from '../domain/promotion.entity'
import {
  AppliedPromotion,
  ChoosePromotionInput,
  ChosenPromotion,
  PROMOTION_REPOSITORY,
  PromotionEngine,
  PromotionRepository,
} from './promotion.ports'

const worth = (discount: PromotionDiscount) => discount.goods + discount.shipping

function applied(promotion: Promotion, discount: PromotionDiscount): AppliedPromotion {
  return {
    promotion: {
      id: promotion.id,
      name: promotion.name,
      code: promotion.code,
      kind: promotion.kind,
      value: promotion.value,
    },
    discount,
  }
}

/**
 * Picks at most one promotion per order: the customer's coupon or the best
 * automatic campaign, whichever takes more off. They never stack.
 */
@Injectable()
export class PromotionEngineService implements PromotionEngine {
  constructor(@Inject(PROMOTION_REPOSITORY) private readonly promotions: PromotionRepository) {}

  async choose(input: ChoosePromotionInput): Promise<ChosenPromotion> {
    const basket = { lines: input.lines, shippingFee: input.shippingFee, now: input.now }

    let coupon: AppliedPromotion | null = null
    if (input.couponCode?.trim()) {
      const code = Promotion.normalizeCode(input.couponCode)
      const promotion = await this.promotions.findByCode(code)
      if (!promotion) {
        throw new CouponNotApplicableError('This code is not valid', { code })
      }
      await this.ensureCustomerMayUse(promotion, input.userId)
      coupon = applied(promotion, promotion.evaluate(basket))
    }

    let best: AppliedPromotion | null = null
    for (const campaign of await this.promotions.listLiveCampaigns(input.now)) {
      try {
        const discount = campaign.evaluate(basket)
        await this.ensureCustomerMayUse(campaign, input.userId)
        if (!best || worth(discount) > worth(best.discount)) best = applied(campaign, discount)
      } catch (error) {
        if (!(error instanceof CouponNotApplicableError)) throw error
      }
    }

    if (coupon && (!best || worth(coupon.discount) >= worth(best.discount))) {
      return { applied: coupon, couponOutranked: false }
    }
    return { applied: best, couponOutranked: coupon !== null }
  }

  async redeem(
    chosen: AppliedPromotion,
    input: { orderId: number; userId: number; now: Date },
    tx: unknown
  ): Promise<void> {
    // The row lock makes the usage-limit check and the increment one step.
    const promotion = await this.promotions.findByIdForUpdate(chosen.promotion.id, tx)
    if (!promotion || !promotion.isLive(input.now)) {
      throw new CouponNotApplicableError('This promotion is no longer available', {
        promotion: chosen.promotion.id,
      })
    }
    await this.ensureCustomerMayUse(promotion, input.userId, tx)

    await this.promotions.addRedemption(
      {
        promotionId: promotion.id,
        orderId: input.orderId,
        userId: input.userId,
        amount: worth(chosen.discount),
      },
      tx
    )
  }

  release(orderId: number, tx: unknown): Promise<void> {
    return this.promotions.releaseRedemption(orderId, tx)
  }

  private async ensureCustomerMayUse(promotion: Promotion, userId: number, tx?: unknown) {
    if (promotion.perCustomerLimit === null) return
    const used = await this.promotions.countRedemptions(promotion.id, userId, tx)
    if (used >= promotion.perCustomerLimit) {
      throw new CouponNotApplicableError(
        'You have already used this code the maximum number of times',
        {
          code: promotion.code,
          perCustomerLimit: promotion.perCustomerLimit,
        }
      )
    }
  }
}
