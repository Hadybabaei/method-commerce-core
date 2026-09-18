import { Global, Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { WinstonModule } from 'nest-winston'
import { LoggerConfig } from '@config/logger.config'
import { buildWinstonOptions } from './winston.config'

@Global()
@Module({
  imports: [
    WinstonModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) =>
        buildWinstonOptions(configService.getOrThrow<LoggerConfig>('logger')),
    }),
  ],
  exports: [WinstonModule],
})
export class LoggingModule {}
