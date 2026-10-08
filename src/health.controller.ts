import { Controller, Get, HttpStatus, Inject, ServiceUnavailableException } from '@nestjs/common'
import { ApiOkResponse, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger'
import { SkipThrottle } from '@nestjs/throttler'
import type Redis from 'ioredis'
import { SEARCH_ENGINE, SearchEngine } from '@modules/search/application/search.ports'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { REDIS_CLIENT } from '@shared/infrastructure/redis/redis.tokens'
import { ApiErrorResponses } from '@shared/presentation/swagger'

export class HealthResponse {
  @ApiProperty({ example: 'ok' })
  status: string

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  timestamp: string
}

type CheckState = 'up' | 'down' | 'disabled'

export class ReadinessChecks {
  @ApiProperty({ enum: ['up', 'down'] }) database: CheckState
  @ApiProperty({ enum: ['up', 'down', 'disabled'] }) redis: CheckState
  @ApiProperty({ enum: ['up', 'down'] }) search: CheckState
}

export class ReadinessResponse extends HealthResponse {
  @ApiProperty({ type: ReadinessChecks }) checks: ReadinessChecks
}

const within = <T>(promise: Promise<T>, ms: number) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('timeout')), ms).unref()
    }),
  ])

@ApiTags('Health')
@Controller('health')
@SkipThrottle()
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis | null,
    @Inject(SEARCH_ENGINE) private readonly search: SearchEngine
  ) {}

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

  @Get('ready')
  @ApiOperation({
    summary: 'Readiness: database, Redis and search',
    description:
      'For load balancers and uptime monitors. 503 with the failing checks when any dependency is down.',
  })
  @ApiOkResponse({ type: ReadinessResponse })
  @ApiErrorResponses(HttpStatus.SERVICE_UNAVAILABLE)
  async ready(): Promise<ReadinessResponse> {
    const probe = async (run: () => Promise<unknown>): Promise<CheckState> => {
      try {
        const result = await within(run(), 2000)
        return result === false ? 'down' : 'up'
      } catch {
        return 'down'
      }
    }
    const [database, redis, search] = await Promise.all([
      probe(() => this.prisma.$queryRaw`SELECT 1`),
      this.redis ? probe(() => this.redis!.ping()) : Promise.resolve<CheckState>('disabled'),
      probe(() => this.search.ping()),
    ])
    const body: ReadinessResponse = {
      status: [database, redis, search].includes('down') ? 'degraded' : 'ok',
      timestamp: new Date().toISOString(),
      checks: { database, redis, search },
    }
    if (body.status !== 'ok') throw new ServiceUnavailableException(body)
    return body
  }
}
