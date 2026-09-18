import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  AccessTokenView,
  AdminView,
  AuthenticatedAdminView,
  AuthenticatedUserView,
  OtpRequestedView,
  UserView,
} from '../../application/dto/views'

/**
 * Documentation-only mirrors of the application views.
 *
 * Each one `implements` the view it documents, so changing a view without
 * updating its schema breaks the build instead of quietly producing wrong
 * documentation.
 */
export class UserResponse implements UserView {
  @ApiProperty({ example: 4 })
  id: number

  @ApiProperty({ example: '09121234567' })
  phoneNumber: string

  @ApiProperty({ example: 'customer@example.com', nullable: true })
  email: string | null

  @ApiProperty({ example: 'user' })
  role: string

  @ApiProperty({ example: 'NORMAL', enum: ['NORMAL', 'HAGHIGHI', 'HOQOOQI'] })
  type: string

  @ApiProperty({
    example: 1,
    description: '0 before the first sign-in, 1 after the phone number is verified.',
  })
  authLevel: number

  @ApiProperty({ example: true })
  activated: boolean

  @ApiProperty({ example: 'https://cdn.method-commerce.ir/avatars/4.jpg', nullable: true })
  avatar: string | null

  @ApiProperty({ example: 'هادی', nullable: true })
  firstName: string | null

  @ApiProperty({ example: 'رضایی', nullable: true })
  lastName: string | null

  @ApiProperty({ nullable: true })
  fatherName: string | null

  @ApiProperty({ example: '0012345678', nullable: true })
  nationalId: string | null

  @ApiProperty({ example: '1370/05/12', nullable: true })
  birthDate: string | null

  @ApiProperty({ example: '02112345678', nullable: true, description: 'Landline.' })
  phone: string | null

  @ApiProperty({ nullable: true })
  companyName: string | null

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  createdAt: Date
}

export class AdminResponse implements AdminView {
  @ApiProperty({ example: 1 })
  id: number

  @ApiProperty({ example: 'admin@method-commerce.local' })
  email: string

  @ApiProperty({ example: 'admin', enum: ['admin', 'operator'] })
  role: string

  @ApiProperty({ example: true })
  active: boolean

  @ApiProperty({ example: 'Super', nullable: true })
  firstName: string | null

  @ApiProperty({ example: 'Admin', nullable: true })
  lastName: string | null

  @ApiProperty({ nullable: true })
  nationalId: string | null

  @ApiProperty({ nullable: true })
  address: string | null

  @ApiProperty({ nullable: true })
  avatarUrl: string | null

  @ApiProperty({ example: '09121234567', nullable: true })
  phoneNumber: string | null

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  createdAt: Date
}

export class OtpRequestedResponse implements OtpRequestedView {
  @ApiProperty({
    example: '0912***4567',
    description: 'Masked, so the response never echoes a full phone number back.',
  })
  phoneNumber: string

  @ApiProperty({ example: '2026-09-11T17:14:16.090Z' })
  expiresAt: Date

  @ApiPropertyOptional({
    example: '12345',
    description: 'Only present when OTP_EXPOSE_IN_RESPONSE is enabled, for local development.',
  })
  code?: string
}

export class AuthenticatedUserResponse implements AuthenticatedUserView {
  @ApiProperty({ description: 'Short-lived bearer token for customer endpoints.' })
  accessToken: string

  @ApiProperty({ description: 'Exchange at /auth/refresh. Revoked by /auth/logout.' })
  refreshToken: string

  @ApiProperty({ type: UserResponse })
  user: UserResponse
}

export class AuthenticatedAdminResponse implements AuthenticatedAdminView {
  @ApiProperty({ description: 'Bearer token for admin endpoints only.' })
  accessToken: string

  @ApiProperty({ type: AdminResponse })
  admin: AdminResponse
}

export class AccessTokenResponse implements AccessTokenView {
  @ApiProperty()
  accessToken: string
}
