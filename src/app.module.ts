import { join } from 'node:path'
import { MiddlewareConsumer, Module, NestModule, Type } from '@nestjs/common'
import { ConfigModule, ConfigService } from '@nestjs/config'
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { ServeStaticModule } from '@nestjs/serve-static'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { configurations, validateEnv } from '@config/index'
import { UploadConfig } from '@config/upload.config'
import { AddressingModule } from '@modules/addressing/addressing.module'
import { BasketModule } from '@modules/basket/basket.module'
import { CatalogModule } from '@modules/catalog/catalog.module'
import { CommentsModule } from '@modules/comments/comments.module'
import { FavoritesModule } from '@modules/favorites/favorites.module'
import { OrderingModule } from '@modules/ordering/ordering.module'
import { NotificationsModule } from '@modules/notifications/notifications.module'
import { isOrderingJobsEnabled, assertProductionOrderingJobs } from '@modules/ordering/ordering-jobs.enabled'
import { IdentityModule } from '@modules/identity/identity.module'
import { LoggingModule } from '@shared/infrastructure/logging/logging.module'
import { PrismaModule } from '@shared/infrastructure/persistence/prisma/prisma.module'
import { RedisModule } from '@shared/infrastructure/redis/redis.module'
import { SharedInfrastructureModule } from '@shared/infrastructure/shared-infrastructure.module'
import { AllExceptionsFilter } from '@shared/presentation/filters/all-exceptions.filter'
import { LoggingInterceptor } from '@shared/presentation/interceptors/logging.interceptor'
import { RequestIdMiddleware } from '@shared/presentation/middleware/request-id.middleware'
import { HealthController } from './health.controller'

const optionalModules = [] as Array<Type<unknown>>
if (isOrderingJobsEnabled()) {
  // Dynamic require so Jest never loads @nestjs/bullmq ESM when jobs are off.
  // Relative path: Node does not resolve tsconfig `@modules/*` aliases in require().
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  optionalModules.push(require('./modules/ordering/ordering-jobs.module').OrderingJobsModule)
}
assertProductionOrderingJobs()

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      load: configurations,
      validate: validateEnv,
      envFilePath: ['.env.local', '.env'],
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 120 }],
    }),
    // Transport for domain events; handlers subscribe with `@OnEvent`.
    EventEmitterModule.forRoot(),
    ServeStaticModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const upload = configService.getOrThrow<UploadConfig>('upload')
        return [
          {
            rootPath: join(process.cwd(), upload.rootDir),
            serveRoot: upload.publicPath,
            serveStaticOptions: { index: false },
          },
        ]
      },
    }),
    LoggingModule,
    PrismaModule,
    RedisModule,
    SharedInfrastructureModule,

    // Bounded contexts.
    IdentityModule,
    AddressingModule,
    CatalogModule,
    FavoritesModule,
    CommentsModule,
    BasketModule,
    OrderingModule,
    NotificationsModule,
    ...optionalModules,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*')
  }
}
