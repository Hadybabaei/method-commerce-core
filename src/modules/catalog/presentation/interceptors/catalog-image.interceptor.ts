import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FileInterceptor } from '@nestjs/platform-express'
import { Observable } from 'rxjs'
import { catalogImageMulterOptions } from '../multer/catalog-image-multer.options'

@Injectable()
export class CatalogImageInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor

  constructor(configService: ConfigService) {
    const InterceptorClass = FileInterceptor('file', catalogImageMulterOptions(configService))
    this.delegate = new InterceptorClass()
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return this.delegate.intercept(context, next)
  }
}
