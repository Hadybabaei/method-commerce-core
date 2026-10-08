import { Module } from '@nestjs/common'
import { IdentityModule } from '@modules/identity/identity.module'
import { PromotionEngineService } from './application/promotion-engine.service'
import { PROMOTION_ENGINE, PROMOTION_REPOSITORY } from './application/promotion.ports'
import {
  CreatePromotionUseCase,
  DeletePromotionUseCase,
  ListPromotionsUseCase,
  UpdatePromotionUseCase,
} from './application/promotion.use-cases'
import { PrismaPromotionRepository } from './infrastructure/prisma-promotion.repository'
import { AdminPromotionsController } from './presentation/admin-promotions.controller'

/**
 * Coupons and automatic campaigns. Ordering asks PROMOTION_ENGINE for the
 * best promotion at checkout and redeems or releases it with the order.
 */
@Module({
  imports: [IdentityModule],
  controllers: [AdminPromotionsController],
  providers: [
    { provide: PROMOTION_REPOSITORY, useClass: PrismaPromotionRepository },
    { provide: PROMOTION_ENGINE, useClass: PromotionEngineService },
    ListPromotionsUseCase,
    CreatePromotionUseCase,
    UpdatePromotionUseCase,
    DeletePromotionUseCase,
  ],
  exports: [PROMOTION_ENGINE],
})
export class PromotionsModule {}
