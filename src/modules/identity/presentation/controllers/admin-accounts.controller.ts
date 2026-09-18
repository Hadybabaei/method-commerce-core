import { Body, Controller, HttpStatus, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiCreatedResponse, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Roles } from '@shared/presentation/decorators/roles.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { CreateAdminUseCase } from '../../application/use-cases/create-admin.use-case'
import { AdminRole } from '../../domain/enums/roles.enum'
import { CreateAdminRequest } from '../dto/admin-auth.request'
import { AdminResponse } from '../dto/identity.response'
import { AdminAuthGuard } from '../guards/admin-auth.guard'
import { RolesGuard } from '../guards/roles.guard'

@ApiTags('Admin accounts')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard, RolesGuard)
@Roles(AdminRole.SuperAdmin)
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(private readonly createAdminUseCase: CreateAdminUseCase) {}

  @Post()
  @ApiOperation({
    summary: 'Create a back-office account (super admin only)',
    description: 'The first super admin comes from the database seed, not from this endpoint.',
  })
  @ApiCreatedResponse({ type: AdminResponse, description: 'The account was created.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.CONFLICT
  )
  create(@Body() body: CreateAdminRequest) {
    return this.createAdminUseCase.execute({
      email: body.email,
      password: body.password,
      role: body.role,
      firstName: body.first_name,
      lastName: body.last_name,
      nationalId: body.national_id,
      address: body.address,
      phoneNumber: body.phone_number,
    })
  }
}
