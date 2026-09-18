import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { Throttle } from '@nestjs/throttler'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { LogoutUseCase } from '../../application/use-cases/logout.use-case'
import { RefreshAccessTokenUseCase } from '../../application/use-cases/refresh-access-token.use-case'
import { RequestOtpUseCase } from '../../application/use-cases/request-otp.use-case'
import { VerifyOtpUseCase } from '../../application/use-cases/verify-otp.use-case'
import { RefreshTokenRequest, RequestOtpRequest, VerifyOtpRequest } from '../dto/auth.request'
import {
  AccessTokenResponse,
  AuthenticatedUserResponse,
  OtpRequestedResponse,
} from '../dto/identity.response'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'

@ApiTags('Auth (customer)')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly requestOtpUseCase: RequestOtpUseCase,
    private readonly verifyOtpUseCase: VerifyOtpUseCase,
    private readonly refreshAccessTokenUseCase: RefreshAccessTokenUseCase,
    private readonly logoutUseCase: LogoutUseCase
  ) {}

  @Post('otp/request')
  @HttpCode(HttpStatus.OK)
  // Tighter than the global limit: this endpoint sends an SMS per call.
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Send a login code to a phone number (signs up unknown numbers)',
    description:
      'Accepts 09xxxxxxxxx, +989xxxxxxxxx, 00989xxxxxxxxx or Persian digits. Limited to 3 requests per minute because each one sends an SMS.',
  })
  @ApiOkResponse({ type: OtpRequestedResponse, description: 'A code was sent.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.TOO_MANY_REQUESTS)
  requestOtp(@Body() body: RequestOtpRequest) {
    return this.requestOtpUseCase.execute({ phoneNumber: body.phone_number })
  }

  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Exchange a login code for an access and refresh token',
    description: 'The code is single-use; verifying it also activates a new account.',
  })
  @ApiOkResponse({ type: AuthenticatedUserResponse, description: 'Signed in.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.UNPROCESSABLE_ENTITY,
    HttpStatus.TOO_MANY_REQUESTS
  )
  verifyOtp(@Body() body: VerifyOtpRequest) {
    return this.verifyOtpUseCase.execute({
      phoneNumber: body.phone_number,
      code: body.otp_code,
    })
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Issue a new access token from a refresh token',
    description: 'Fails if the token does not match the one stored for the account.',
  })
  @ApiOkResponse({ type: AccessTokenResponse, description: 'A fresh access token.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  refresh(@Body() body: RefreshTokenRequest) {
    return this.refreshAccessTokenUseCase.execute({ refreshToken: body.refresh_token })
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('customer')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Revoke the stored refresh token',
    description: 'The access token stays valid until it expires on its own.',
  })
  @ApiNoContentResponse({ description: 'The refresh token was revoked.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  async logout(@CurrentActor('id') userId: number): Promise<void> {
    await this.logoutUseCase.execute({ userId })
  }
}
