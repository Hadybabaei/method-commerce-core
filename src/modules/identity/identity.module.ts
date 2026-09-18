import { Module } from '@nestjs/common'
import { ADMIN_REPOSITORY } from './domain/repositories/admin.repository'
import { USER_REPOSITORY } from './domain/repositories/user.repository'
import { AdminLoginUseCase } from './application/use-cases/admin-login.use-case'
import { ChangeAdminPasswordUseCase } from './application/use-cases/change-admin-password.use-case'
import { CreateAdminUseCase } from './application/use-cases/create-admin.use-case'
import { GetCurrentAdminUseCase } from './application/use-cases/get-current-admin.use-case'
import { GetCurrentUserUseCase } from './application/use-cases/get-current-user.use-case'
import { LogoutUseCase } from './application/use-cases/logout.use-case'
import { RefreshAccessTokenUseCase } from './application/use-cases/refresh-access-token.use-case'
import { RequestAdminPasswordResetUseCase } from './application/use-cases/request-admin-password-reset.use-case'
import { RequestOtpUseCase } from './application/use-cases/request-otp.use-case'
import { ResetAdminPasswordUseCase } from './application/use-cases/reset-admin-password.use-case'
import { UpdateUserInfoUseCase } from './application/use-cases/update-user-info.use-case'
import { VerifyOtpUseCase } from './application/use-cases/verify-otp.use-case'
import { IdentityAuditListener } from './infrastructure/events/identity-audit.listener'
import { PrismaAdminRepository } from './infrastructure/persistence/prisma-admin.repository'
import { PrismaUserRepository } from './infrastructure/persistence/prisma-user.repository'
import { AdminAccountsController } from './presentation/controllers/admin-accounts.controller'
import { AdminAuthController } from './presentation/controllers/admin-auth.controller'
import { AuthController } from './presentation/controllers/auth.controller'
import { UsersController } from './presentation/controllers/users.controller'
import { AdminAuthGuard } from './presentation/guards/admin-auth.guard'
import { JwtAuthGuard } from './presentation/guards/jwt-auth.guard'
import { MinAuthLevelGuard } from './presentation/guards/min-auth-level.guard'
import { RolesGuard } from './presentation/guards/roles.guard'

const useCases = [
  RequestOtpUseCase,
  VerifyOtpUseCase,
  RefreshAccessTokenUseCase,
  LogoutUseCase,
  GetCurrentUserUseCase,
  UpdateUserInfoUseCase,
  AdminLoginUseCase,
  GetCurrentAdminUseCase,
  RequestAdminPasswordResetUseCase,
  ResetAdminPasswordUseCase,
  ChangeAdminPasswordUseCase,
  CreateAdminUseCase,
]

const guards = [JwtAuthGuard, AdminAuthGuard, RolesGuard, MinAuthLevelGuard]

/**
 * Identity bounded context: customer OTP login, admin password login and the
 * account/profile data behind both. Exports its guards so other contexts can
 * protect their own routes without re-implementing authentication.
 */
@Module({
  controllers: [AuthController, UsersController, AdminAuthController, AdminAccountsController],
  providers: [
    { provide: USER_REPOSITORY, useClass: PrismaUserRepository },
    { provide: ADMIN_REPOSITORY, useClass: PrismaAdminRepository },
    ...useCases,
    ...guards,
    IdentityAuditListener,
  ],
  exports: [USER_REPOSITORY, ADMIN_REPOSITORY, ...guards],
})
export class IdentityModule {}
