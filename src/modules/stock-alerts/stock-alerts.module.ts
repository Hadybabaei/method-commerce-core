import { Module } from '@nestjs/common'
import { IdentityModule } from '@modules/identity/identity.module'
import {
  STOCK_ALERT_STORE,
  StockAlertNotifier,
  StockAlertsService,
} from './application/stock-alerts'
import { PrismaStockAlertStore } from './infrastructure/prisma-stock-alert.store'
import { StockAlertsController } from './presentation/stock-alerts.controller'

/** Back-in-stock SMS alerts per variant. */
@Module({
  imports: [IdentityModule],
  controllers: [StockAlertsController],
  providers: [
    { provide: STOCK_ALERT_STORE, useClass: PrismaStockAlertStore },
    StockAlertsService,
    StockAlertNotifier,
  ],
})
export class StockAlertsModule {}
