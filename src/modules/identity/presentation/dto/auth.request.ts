import { ApiProperty } from '@nestjs/swagger'
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator'

export class RequestOtpRequest {
  @ApiProperty({ example: '09121234567', description: 'Iranian mobile number' })
  @IsString()
  @IsNotEmpty()
  phone_number: string
}

export class VerifyOtpRequest {
  @ApiProperty({ example: '09121234567' })
  @IsString()
  @IsNotEmpty()
  phone_number: string

  @ApiProperty({ example: '12345' })
  @IsString()
  @Matches(/^\d+$/, { message: 'otp_code must contain digits only' })
  @Length(4, 8)
  otp_code: string
}

export class RefreshTokenRequest {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  refresh_token: string
}
