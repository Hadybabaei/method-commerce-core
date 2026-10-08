import { Module } from '@nestjs/common'
import { APP_INTERCEPTOR } from '@nestjs/core'
import { IdentityModule } from '@modules/identity/identity.module'
import {
  AUDIT_LOG,
  CUSTOMERS_SERVICE,
  REPORTS_READ_MODEL,
  STOCK_SERVICE,
} from './application/backoffice.ports'
import { AdminAuditInterceptor } from './infrastructure/admin-audit.interceptor'
import { PrismaAuditLog } from './infrastructure/prisma-audit-log'
import { PrismaCustomersService } from './infrastructure/prisma-customers.service'
import { PrismaReportsReadModel } from './infrastructure/prisma-reports.read-model'
import { PrismaStockService } from './infrastructure/prisma-stock.service'
import {
  AdminAuditLogController,
  AdminCustomersController,
  AdminReportsController,
  AdminStockController,
} from './presentation/backoffice.controllers'

/**
 * Back-office tools across the other modules: dashboard and reports,
 * customers, stock levels and the admin audit log (recorded for every
 * admin route by a global interceptor).
 */
@Module({
  imports: [IdentityModule],
  controllers: [
    AdminReportsController,
    AdminCustomersController,
    AdminStockController,
    AdminAuditLogController,
  ],
  providers: [
    { provide: REPORTS_READ_MODEL, useClass: PrismaReportsReadModel },
    { provide: CUSTOMERS_SERVICE, useClass: PrismaCustomersService },
    { provide: STOCK_SERVICE, useClass: PrismaStockService },
    { provide: AUDIT_LOG, useClass: PrismaAuditLog },
    { provide: APP_INTERCEPTOR, useClass: AdminAuditInterceptor },
  ],
})
export class BackofficeModule {}
