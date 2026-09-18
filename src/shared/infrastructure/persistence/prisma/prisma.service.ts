import { Inject, Injectable, LoggerService, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { PrismaClient } from '@prisma/client'

/** Prisma client handed to code running inside `$transaction`. */
export type PrismaTransaction = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(@Inject(WINSTON_MODULE_NEST_PROVIDER) private readonly logger: LoggerService) {
    super({
      log: [
        { emit: 'event', level: 'warn' },
        { emit: 'event', level: 'error' },
      ],
    })
  }

  async onModuleInit(): Promise<void> {
    // Prisma's typed event map is generated from the `log` option above, which
    // TypeScript cannot narrow through the subclass constructor.
    const client = this as unknown as {
      $on: (event: 'warn' | 'error', callback: (payload: { message: string }) => void) => void
    }

    client.$on('warn', ({ message }) => this.logger.warn(message, 'Prisma'))
    client.$on('error', ({ message }) => this.logger.error(message, undefined, 'Prisma'))

    await this.$connect()
    this.logger.log('Database connection established', 'Prisma')
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect()
  }
}
