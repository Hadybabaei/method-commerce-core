import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger'
import { RequirePermission } from '@shared/presentation/decorators/require-permission.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { CreateAdminUseCase } from '../../application/use-cases/create-admin.use-case'
import {
  ListAdminsUseCase,
  UpdateAdminPermissionsUseCase,
} from '../../application/use-cases/manage-admins.use-cases'
import { CreateAdminRequest, UpdateAdminPermissionsRequest } from '../dto/admin-auth.request'
import { AdminResponse } from '../dto/identity.response'
import { AdminAuthGuard } from '../guards/admin-auth.guard'

@ApiTags('Admin accounts')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@RequirePermission('admins')
@Controller('admin/accounts')
export class AdminAccountsController {
  constructor(
    private readonly createAdminUseCase: CreateAdminUseCase,
    private readonly listAdminsUseCase: ListAdminsUseCase,
    private readonly updateAdminPermissionsUseCase: UpdateAdminPermissionsUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'List back-office accounts with their permissions' })
  @ApiOkResponse({ type: [AdminResponse] })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED, HttpStatus.FORBIDDEN)
  list() {
    return this.listAdminsUseCase.execute()
  }

  @Post()
  @ApiOperation({
    summary: 'Create a back-office account',
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
      permissions: body.permissions,
      firstName: body.first_name,
      lastName: body.last_name,
      nationalId: body.national_id,
      address: body.address,
      phoneNumber: body.phone_number,
    })
  }

  @Put(':id/permissions')
  @ApiOperation({
    summary: "Replace an admin's permissions",
    description: 'The super admin always holds every permission and cannot be changed here.',
  })
  @ApiOkResponse({ type: AdminResponse })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  updatePermissions(
    @Param('id', ParseIntPipe) adminId: number,
    @Body() body: UpdateAdminPermissionsRequest
  ) {
    return this.updateAdminPermissionsUseCase.execute({ adminId, permissions: body.permissions })
  }
}
