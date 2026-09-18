import { Body, Controller, Get, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import {
  ApiAcceptedResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses, MessageResponse } from '@shared/presentation/swagger'
import { AdminLoginUseCase } from '../../application/use-cases/admin-login.use-case'
import { ChangeAdminPasswordUseCase } from '../../application/use-cases/change-admin-password.use-case'
import { GetCurrentAdminUseCase } from '../../application/use-cases/get-current-admin.use-case'
import { RequestAdminPasswordResetUseCase } from '../../application/use-cases/request-admin-password-reset.use-case'
import { ResetAdminPasswordUseCase } from '../../application/use-cases/reset-admin-password.use-case'
import {
  AdminLoginRequest,
  ChangePasswordRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../dto/admin-auth.request'
import { AdminResponse, AuthenticatedAdminResponse } from '../dto/identity.response'
import { AdminAuthGuard } from '../guards/admin-auth.guard'

@ApiTags('Auth (admin)')
@Controller('admin/auth')
export class AdminAuthController {
  constructor(
    private readonly adminLoginUseCase: AdminLoginUseCase,
    private readonly getCurrentAdminUseCase: GetCurrentAdminUseCase,
    private readonly requestPasswordResetUseCase: RequestAdminPasswordResetUseCase,
    private readonly resetPasswordUseCase: ResetAdminPasswordUseCase,
    private readonly changePasswordUseCase: ChangeAdminPasswordUseCase
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Sign in with email and password',
    description:
      'Returns an access token for admin endpoints only; it is rejected by customer endpoints.',
  })
  @ApiOkResponse({ type: AuthenticatedAdminResponse, description: 'Signed in.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.TOO_MANY_REQUESTS)
  login(@Body() body: AdminLoginRequest) {
    return this.adminLoginUseCase.execute({ email: body.email, password: body.password })
  }

  @Get('me')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('admin')
  @ApiOperation({ summary: 'Profile of the signed-in admin' })
  @ApiOkResponse({ type: AdminResponse, description: 'The admin account.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  getMe(@CurrentActor('id') adminId: number) {
    return this.getCurrentAdminUseCase.execute(adminId)
  }

  @Post('forgot-password')
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Email a password reset token',
    description: 'Always succeeds, so the response cannot reveal whether the email exists.',
  })
  @ApiAcceptedResponse({
    type: MessageResponse,
    description: 'Accepted whether or not the account exists.',
  })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
  async forgotPassword(@Body() body: ForgotPasswordRequest): Promise<MessageResponse> {
    await this.requestPasswordResetUseCase.execute({ email: body.email })

    return { success: true, message: 'If the account exists, a reset token has been emailed' }
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Set a new password using an emailed reset token',
    description: 'The token is single-use and expires; replaying it fails.',
  })
  @ApiOkResponse({ type: MessageResponse, description: 'The password was replaced.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  async resetPassword(@Body() body: ResetPasswordRequest): Promise<MessageResponse> {
    await this.resetPasswordUseCase.execute({
      email: body.email,
      token: body.token,
      newPassword: body.new_password,
    })

    return { success: true, message: 'Password updated' }
  }

  @Post('change-password')
  @UseGuards(AdminAuthGuard)
  @ApiBearerAuth('admin')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Change the signed-in admin password',
    description: 'Requires the current password, and the new one must differ from it.',
  })
  @ApiOkResponse({ type: MessageResponse, description: 'The password was replaced.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  async changePassword(
    @CurrentActor('id') adminId: number,
    @Body() body: ChangePasswordRequest
  ): Promise<MessageResponse> {
    await this.changePasswordUseCase.execute({
      adminId,
      currentPassword: body.current_password,
      newPassword: body.new_password,
    })

    return { success: true, message: 'Password updated' }
  }
}
