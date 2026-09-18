import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { FilesInterceptor } from '@nestjs/platform-express'
import { Observable } from 'rxjs'
import { commentImageMulterOptions } from '../multer/comment-image-multer.options'

/**
 * Wraps Nest's FilesInterceptor so multer limits come from UploadConfig
 * instead of being hard-coded on every route decorator.
 */
@Injectable()
export class CommentImagesInterceptor implements NestInterceptor {
  private readonly delegate: NestInterceptor

  constructor(configService: ConfigService) {
    const InterceptorClass = FilesInterceptor(
      'images',
      configService.getOrThrow<{ maxImagesPerComment: number }>('upload').maxImagesPerComment,
      commentImageMulterOptions(configService)
    )
    this.delegate = new InterceptorClass()
  }

  intercept(
    context: ExecutionContext,
    next: CallHandler
  ): Observable<unknown> | Promise<Observable<unknown>> {
    return this.delegate.intercept(context, next)
  }
}
