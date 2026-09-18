import { Controller, Get, HttpStatus, Param, ParseIntPipe } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponses } from '@shared/presentation/swagger'
import {
  ListCitiesUseCase,
  ListProvincesUseCase,
} from '../../application/use-cases/list-locations.use-case'
import { CityResponse, ProvinceResponse } from '../dto/addressing.response'

/** Reference data the address form needs. Public on purpose. */
@ApiTags('Locations')
@Controller('locations')
export class LocationsController {
  constructor(
    private readonly listProvincesUseCase: ListProvincesUseCase,
    private readonly listCitiesUseCase: ListCitiesUseCase
  ) {}

  @Get('provinces')
  @ApiOperation({ summary: 'List all provinces' })
  @ApiOkResponse({ type: [ProvinceResponse], description: 'All provinces, ordered by name.' })
  listProvinces() {
    return this.listProvincesUseCase.execute()
  }

  @Get('provinces/:id/cities')
  @ApiOperation({ summary: 'List the cities of a province' })
  @ApiParam({ name: 'id', example: 8, description: 'Province id.' })
  @ApiOkResponse({ type: [CityResponse], description: 'Cities of that province.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  listCities(@Param('id', ParseIntPipe) provinceId: number) {
    return this.listCitiesUseCase.execute(provinceId)
  }
}
