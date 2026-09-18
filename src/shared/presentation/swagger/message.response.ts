import { ApiProperty } from '@nestjs/swagger'

/** Acknowledgement for an action that has nothing to return. */
export class MessageResponse {
  @ApiProperty({ example: true })
  success: boolean

  @ApiProperty({ example: 'Password updated' })
  message: string
}
