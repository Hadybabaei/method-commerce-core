import { Promotion, PromotionDiscount, PromotionKind, PricedLine } from '../domain/promotion.entity'

export interface PromotionRepository {
  findById(id: number): Promise<Promotion | null>
  findByCode(code: string): Promise<Promotion | null>
  /** Active automatic campaigns (no code) that have started and not ended. */
  listLiveCampaigns(now: Date): Promise<Promotion[]>
  list(): Promise<Promotion[]>
  save(promotion: Promotion): Promise<Promotion>
  delete(id: number): Promise<void>

  /** Locks the promotion row inside a transaction and reloads it. */
  findByIdForUpdate(id: number, tx: unknown): Promise<Promotion | null>
  countRedemptions(promotionId: number, userId: number, tx?: unknown): Promise<number>
  /** Inserts the redemption and bumps used_count. */
  addRedemption(
    input: { promotionId: number; orderId: number; userId: number; amount: number },
    tx: unknown
  ): Promise<void>
  /** Removes an order's redemption, if any, and lowers used_count. */
  releaseRedemption(orderId: number, tx: unknown): Promise<void>
}

export const PROMOTION_REPOSITORY = Symbol('PromotionRepository')

/** What an order keeps of the promotion it used. */
export interface PromotionSnapshot {
  id: number
  name: string
  code: string | null
  kind: PromotionKind
  value: number
}

export interface AppliedPromotion {
  promotion: PromotionSnapshot
  discount: PromotionDiscount
}

export interface ChoosePromotionInput {
  userId: number
  /** What the customer typed, if anything. */
  couponCode?: string | null
  lines: PricedLine[]
  shippingFee: number
  now: Date
}

export interface ChosenPromotion {
  applied: AppliedPromotion | null
  /** True when the customer's coupon was valid but a campaign was worth more. */
  couponOutranked: boolean
}

/** Used by checkout: pick the best promotion, then redeem or release it with the order. */
export interface PromotionEngine {
  choose(input: ChoosePromotionInput): Promise<ChosenPromotion>
  redeem(
    applied: AppliedPromotion,
    input: { orderId: number; userId: number; now: Date },
    tx: unknown
  ): Promise<void>
  release(orderId: number, tx: unknown): Promise<void>
}

export const PROMOTION_ENGINE = Symbol('PromotionEngine')
