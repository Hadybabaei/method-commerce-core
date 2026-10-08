import { INestApplication, ValidationPipe } from '@nestjs/common'
import { InvalidInputError } from '@shared/domain/errors'

/**
 * Global HTTP behaviour shared by main.ts and the end-to-end tests: the API
 * prefix and request validation.
 */
export function configureHttp(app: INestApplication, apiPrefix: string): void {
  app.setGlobalPrefix(apiPrefix)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Request validation failures surface as domain errors so the exception
      // filter renders one consistent error shape.
      exceptionFactory: (errors) =>
        new InvalidInputError('Request validation failed', {
          errors: errors.flatMap((error) => Object.values(error.constraints ?? {})),
        }),
    })
  )
}
