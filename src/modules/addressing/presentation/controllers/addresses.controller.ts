import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import { CreateAddressUseCase } from '../../application/use-cases/create-address.use-case'
import { DeleteAddressUseCase } from '../../application/use-cases/delete-address.use-case'
import { GetAddressUseCase } from '../../application/use-cases/get-address.use-case'
import { ListUserAddressesUseCase } from '../../application/use-cases/list-user-addresses.use-case'
import { UpdateAddressUseCase } from '../../application/use-cases/update-address.use-case'
import { CreateAddressRequest, UpdateAddressRequest } from '../dto/address.request'
import { AddressResponse } from '../dto/addressing.response'

/**
 * Addresses are always scoped to the signed-in customer: the owner comes from
 * the access token, never from the request.
 */
@ApiTags('Addresses')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller('users/me/addresses')
export class AddressesController {
  constructor(
    private readonly createAddressUseCase: CreateAddressUseCase,
    private readonly updateAddressUseCase: UpdateAddressUseCase,
    private readonly deleteAddressUseCase: DeleteAddressUseCase,
    private readonly getAddressUseCase: GetAddressUseCase,
    private readonly listUserAddressesUseCase: ListUserAddressesUseCase
  ) {}

  @Get()
  @ApiOperation({ summary: 'List the addresses of the signed-in customer' })
  @ApiOkResponse({ type: [AddressResponse], description: 'Every address on the account.' })
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  list(@CurrentActor('id') userId: number) {
    return this.listUserAddressesUseCase.execute(userId)
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one address' })
  @ApiParam({ name: 'id', example: 3 })
  @ApiOkResponse({ type: AddressResponse, description: 'The address.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND
  )
  get(@CurrentActor('id') userId: number, @Param('id', ParseIntPipe) addressId: number) {
    return this.getAddressUseCase.execute({ addressId, userId })
  }

  @Post()
  @ApiOperation({
    summary: 'Add an address',
    description: 'The city must belong to the province when both are sent.',
  })
  @ApiCreatedResponse({ type: AddressResponse, description: 'The address was saved.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  create(@CurrentActor('id') userId: number, @Body() body: CreateAddressRequest) {
    return this.createAddressUseCase.execute({
      userId,
      title: body.title,
      cityId: body.city_id,
      provinceId: body.province_id,
      hood: body.hood,
      postalCode: body.postalCode,
      pelak: body.pelak,
      vahed: body.vahed,
      details: body.details,
      ownReceiver: body.ownReceiver,
      receiverFullName: body.receiverFullName,
      receiverPhoneNumber: body.receiverPhoneNumber,
      latitude: body.lat,
      longitude: body.long,
    })
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update an address',
    description: 'Only the fields present in the body are changed.',
  })
  @ApiParam({ name: 'id', example: 3 })
  @ApiOkResponse({ type: AddressResponse, description: 'The updated address.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND
  )
  update(
    @CurrentActor('id') userId: number,
    @Param('id', ParseIntPipe) addressId: number,
    @Body() body: UpdateAddressRequest
  ) {
    return this.updateAddressUseCase.execute({
      addressId,
      userId,
      title: body.title,
      cityId: body.city_id,
      provinceId: body.province_id,
      hood: body.hood,
      postalCode: body.postalCode,
      pelak: body.pelak,
      vahed: body.vahed,
      details: body.details,
      ownReceiver: body.ownReceiver,
      receiverFullName: body.receiverFullName,
      receiverPhoneNumber: body.receiverPhoneNumber,
      latitude: body.lat,
      longitude: body.long,
    })
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an address' })
  @ApiParam({ name: 'id', example: 3 })
  @ApiNoContentResponse({ description: 'The address was deleted.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND
  )
  async remove(
    @CurrentActor('id') userId: number,
    @Param('id', ParseIntPipe) addressId: number
  ): Promise<void> {
    await this.deleteAddressUseCase.execute({ addressId, userId })
  }
}
