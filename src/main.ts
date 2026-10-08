import { ConfigService } from '@nestjs/config'
import { AppConfig } from '@config/app.config'
import { createApp } from './app.factory'

async function bootstrap(): Promise<void> {
  const app = await createApp()
  app.enableShutdownHooks()
  await app.listen(app.get(ConfigService).getOrThrow<AppConfig>('app').port)
}

void bootstrap()
