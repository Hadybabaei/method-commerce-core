import { ADMIN_PERMISSIONS, AdminPermission } from '../../domain/permissions'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator'
import { AdminRole } from '../../domain/enums/roles.enum'

export class AdminLoginRequest {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ example: 'secret123' })
  @IsString()
  @IsNotEmpty()
  password: string
}

export class ForgotPasswordRequest {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string
}

export class ResetPasswordRequest {
  @ApiProperty({ example: 'admin@example.com' })
  @IsEmail()
  email: string

  @ApiProperty({ description: 'Token emailed by the forgot-password endpoint' })
  @IsString()
  @IsNotEmpty()
  token: string

  @ApiProperty({ description: 'At least 8 characters, with a letter and a digit' })
  @IsString()
  @IsNotEmpty()
  new_password: string
}

export class ChangePasswordRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  current_password: string

  @ApiProperty({ description: 'At least 8 characters, with a letter and a digit' })
  @IsString()
  @IsNotEmpty()
  new_password: string
}

export class CreateAdminRequest {
  @ApiProperty({ example: 'operator@example.com' })
  @IsEmail()
  email: string

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  password: string

  @ApiProperty({ enum: AdminRole, example: AdminRole.Operator })
  @IsEnum(AdminRole)
  role: AdminRole

  @ApiPropertyOptional({
    type: [String],
    enum: ADMIN_PERMISSIONS,
    description: 'Ignored for the super admin role, which holds every permission.',
  })
  @IsOptional()
  @IsArray()
  @IsIn([...ADMIN_PERMISSIONS], { each: true })
  permissions?: AdminPermission[]

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  first_name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  last_name?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  national_id?: string

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  address?: string

  @ApiPropertyOptional({ example: '09121234567' })
  @IsOptional()
  @IsString()
  phone_number?: string
}

export class UpdateAdminPermissionsRequest {
  @ApiProperty({ type: [String], enum: ADMIN_PERMISSIONS, example: ['orders', 'refunds'] })
  @IsArray()
  @IsIn([...ADMIN_PERMISSIONS], { each: true })
  permissions: AdminPermission[]
}
