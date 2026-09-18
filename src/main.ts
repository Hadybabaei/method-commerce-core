import 'reflect-metadata'
import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import compression from 'compression'
import helmet from 'helmet'
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston'
import { AppConfig } from '@config/app.config'
import { InvalidInputError } from '@shared/domain/errors'
import { AppModule } from './app.module'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true })

  // Winston replaces the default logger everywhere, including Nest internals.
  app.useLogger(app.get(WINSTON_MODULE_NEST_PROVIDER))

  const config = app.get(ConfigService).getOrThrow<AppConfig>('app')

  app.use(helmet())
  app.use(compression())
  app.setGlobalPrefix(config.apiPrefix)
  app.enableCors({
    origin: config.corsOrigins.length > 0 ? config.corsOrigins : true,
    credentials: true,
  })

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

  app.enableShutdownHooks()

  if (!config.isProduction) {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('method-commerce API')
        .setDescription(
          [
            'Customer and back-office API for the method-commerce store.',
            '',
            'Customers authenticate with a phone number and an SMS code; administrators with an email and a password. The two access tokens are not interchangeable — an admin token is rejected by customer endpoints and the other way round — so pick the matching scheme under Authorize.',
            '',
            'Every failure shares one response shape, described by the ErrorResponse schema, with a stable `code` field to branch on and the `x-request-id` echoed back for matching against the logs. Prices are whole Rial.',
          ].join('\n')
        )
        .setVersion('0.1.0')
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Customer access token from POST /auth/otp/verify.',
          },
          'customer'
        )
        .addBearerAuth(
          {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Admin access token from POST /admin/auth/login.',
          },
          'admin'
        )
        .addTag('Health', 'Liveness probe')
        .addTag('Auth (customer)', 'Phone number and SMS code sign-in')
        .addTag('Users', 'The signed-in customer account')
        .addTag('Addresses', 'Delivery addresses of the signed-in customer')
        .addTag('Favorites', 'Wishlist of published products for the signed-in customer')
        .addTag('Basket', 'Open cart of product variants for the signed-in customer')
        .addTag('Orders', 'Checkout from the basket and the customer order history')
        .addTag('Notifications', 'In-app inbox for the signed-in customer')
        .addTag('Comments', 'Product comments, replies and customer uploads')
        .addTag('Locations', 'Province and city reference data')
        .addTag('Catalog', 'Storefront reads: categories, brands and published products')
        .addTag('Auth (admin)', 'Back-office sign-in and password management')
        .addTag('Admin accounts', 'Back-office account creation')
        .addTag('Admin catalog', 'Managing categories, brands and products')
        .addTag('Admin comments', 'Moderation queue, admin replies and approval')
        .addTag('Admin orders', 'Back-office order list, detail and cancel')
        .addTag('Admin notifications', 'Back-office inbox of store events')
        .build()
    )

    // The JSON is served alongside at `${path}-json`, for client generators.
    SwaggerModule.setup(`${config.apiPrefix}/docs`, app, document, {
      swaggerOptions: {
        // Keeps the entered token across reloads, which matters while testing
        // the admin endpoints by hand.
        persistAuthorization: true,
        docExpansion: 'list',
        tagsSorter: 'alpha',
      },
    })
  }

  await app.listen(config.port)
}

void bootstrap()
