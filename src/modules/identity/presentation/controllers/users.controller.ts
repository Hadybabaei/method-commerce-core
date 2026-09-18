import { Body, Controller, Get, HttpStatus, Patch, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { GetCurrentUserUseCase } from '../../application/use-cases/get-current-user.use-case'
import { UpdateUserInfoUseCase } from '../../application/use-cases/update-user-info.use-case'
import { UpdateUserInfoRequest } from '../dto/update-user-info.request'
import { UserResponse } from '../dto/identity.response'
import { JwtAuthGuard } from '../guards/jwt-auth.guard'

@ApiTags('Users')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly getCurrentUserUseCase: GetCurrentUserUseCase,
    private readonly updateUserInfoUseCase: UpdateUserInfoUseCase
  ) {}

  @Get('me')
  @ApiOperation({
    summary: 'Profile of the signed-in customer',
    description: 'The account is taken from the access token, never from the request.',
  })
  @ApiOkResponse({ type: UserResponse, description: 'The account and its profile.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  getMe(@CurrentActor('id') userId: number) {
    return this.getCurrentUserUseCase.execute(userId)
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update the signed-in customer account and profile',
    description: 'Only the fields present in the body are changed.',
  })
  @ApiOkResponse({ type: UserResponse, description: 'The updated profile.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  updateMe(@CurrentActor('id') userId: number, @Body() body: UpdateUserInfoRequest) {
    return this.updateUserInfoUseCase.execute({
      userId,
      email: body.email,
      avatar: body.avatar,
      firstName: body.first_name,
      lastName: body.last_name,
      fatherName: body.father_name,
      nationalId: body.national_id,
      birthDate: body.birth_date,
      phone: body.phone,
      companyName: body.company_name,
    })
  }
}
