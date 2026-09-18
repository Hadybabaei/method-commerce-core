import { Global, Logger, Module, OnModuleDestroy } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { RedisConfig } from '@config/redis.config'
import Redis from 'ioredis'
import { OTP_CHALLENGE_STORE } from '@shared/application/ports/otp-challenge-store.port'
import { InMemoryOtpChallengeStore } from './in-memory-otp-challenge.store'
import { RedisOtpChallengeStore } from './redis-otp-challenge.store'
import { REDIS_CLIENT } from './redis.tokens'

/**
 * Provides a shared ioredis client when Redis is enabled, otherwise leaves
 * REDIS_CLIENT unbound and binds an in-memory OTP store for local/tests.
 */
@Global()
@Module({
  providers: [
    {
      provide: REDIS_CLIENT,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): Redis | null => {
        const redis = configService.getOrThrow<RedisConfig>('redis')
        if (!redis.enabled) {
          return null
        }

        const logger = new Logger('RedisModule')
        const client = new Redis(redis.url, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        })

        client.on('error', (error) => {
          logger.warn(`Redis error: ${error.message}`)
        })

        return client
      },
    },
    {
      provide: OTP_CHALLENGE_STORE,
      inject: [REDIS_CLIENT],
      useFactory: (client: Redis | null) =>
        client ? new RedisOtpChallengeStore(client) : new InMemoryOtpChallengeStore(),
    },
    {
      provide: 'RedisShutdown',
      inject: [REDIS_CLIENT],
      useFactory: (client: Redis | null) =>
        new (class implements OnModuleDestroy {
          async onModuleDestroy(): Promise<void> {
            if (client) {
              await client.quit().catch(() => undefined)
            }
          }
        })(),
    },
  ],
  exports: [REDIS_CLIENT, OTP_CHALLENGE_STORE],
})
export class RedisModule {}
