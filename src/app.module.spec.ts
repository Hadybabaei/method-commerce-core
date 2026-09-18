import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { InvalidInputError } from '@shared/domain/errors'
import { PrismaService } from '@shared/infrastructure/persistence/prisma/prisma.service'
import { AppModule } from './app.module'

/**
 * Boots the real application graph with the database stubbed out, so a missing
 * provider, an unbound port or a broken route registration fails here instead
 * of at deploy time.
 */
describe('AppModule', () => {
  let app: INestApplication

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService)
      .useValue({})
      .compile()

    app = moduleRef.createNestApplication()
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        exceptionFactory: (errors) =>
          new InvalidInputError('Request validation failed', {
            errors: errors.flatMap((error) => Object.values(error.constraints ?? {})),
          }),
      })
    )

    await app.init()
  })

  afterAll(async () => {
    await app?.close()
  })

  it('rejects a malformed request with the shared error shape', async () => {
    const response = await request(app.getHttpServer()).post('/auth/otp/request').send({})

    expect(response.status).toBe(400)
    expect(response.body).toMatchObject({
      success: false,
      code: 'INVALID_INPUT',
      message: 'Request validation failed',
    })
    expect(response.headers['x-request-id']).toBeDefined()
  })

  it('requires a bearer token on protected routes', async () => {
    const response = await request(app.getHttpServer()).get('/users/me')

    expect(response.status).toBe(401)
    expect(response.body.code).toBe('UNAUTHENTICATED')
  })

  it('rejects an unknown field instead of silently ignoring it', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/otp/request')
      .send({ phone_number: '09121234567', role: 'admin' })

    expect(response.status).toBe(400)
  })

  it('requires refresh_token on /auth/refresh', async () => {
    const response = await request(app.getHttpServer()).post('/auth/refresh').send({})

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_INPUT')
  })

  it('requires a bearer token on customer logout', async () => {
    const response = await request(app.getHttpServer()).post('/auth/logout')

    expect(response.status).toBe(401)
    expect(response.body.code).toBe('UNAUTHENTICATED')
  })

  it('requires credentials on admin login', async () => {
    const response = await request(app.getHttpServer()).post('/admin/auth/login').send({})

    expect(response.status).toBe(400)
    expect(response.body.code).toBe('INVALID_INPUT')
  })

  it('requires a bearer token on admin me', async () => {
    const response = await request(app.getHttpServer()).get('/admin/auth/me')

    expect(response.status).toBe(401)
    expect(response.body.code).toBe('UNAUTHENTICATED')
  })

  it('requires a bearer token on customer notifications', async () => {
    const response = await request(app.getHttpServer()).get('/users/me/notifications')

    expect(response.status).toBe(401)
    expect(response.body.code).toBe('UNAUTHENTICATED')
  })
})
