import { Controller, Get, HttpStatus } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { ApiErrorResponses } from '@shared/presentation/swagger'

export class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status: string

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  timestamp: string
}

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({
    summary: 'Liveness and database connectivity',
    description: 'Runs a trivial query, so a failure here means the database is unreachable.',
  })
  @ApiOkResponse({ type: HealthResponse, description: 'The service and its database are up.' })
  @ApiErrorResponses(HttpStatus.INTERNAL_SERVER_ERROR)
  async check(): Promise<HealthResponse> {
    await this.prisma.$queryRaw`SELECT 1`

    return { status: 'ok', timestamp: new Date().toISOString() }
  }
}
