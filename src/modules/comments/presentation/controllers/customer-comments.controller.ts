import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Post,
  Query,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common'
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { JwtAuthGuard } from '@modules/identity/presentation/guards/jwt-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { CreateCommentUseCase } from '../../application/use-cases/create-comment.use-case'
import { DeleteCommentUseCase } from '../../application/use-cases/delete-comment.use-case'
import { ListUserCommentsUseCase } from '../../application/use-cases/list-comments.use-case'
import { CreateCommentRequest, ListCommentsQueryRequest } from '../dto/comment.request'
import { CommentResponse } from '../dto/comment.response'
import { CommentImagesInterceptor } from '../interceptors/comment-images.interceptor'

@ApiTags('Comments')
@ApiBearerAuth('customer')
@UseGuards(JwtAuthGuard)
@Controller()
export class CustomerCommentsController {
  constructor(
    private readonly createCommentUseCase: CreateCommentUseCase,
    private readonly deleteCommentUseCase: DeleteCommentUseCase,
    private readonly listUserCommentsUseCase: ListUserCommentsUseCase
  ) {}

  @Get('users/me/comments')
  @ApiOperation({
    summary: 'List the signed-in customer comments',
    description: 'Includes pending (unpublished) comments so the author can see them.',
  })
  @ApiPaginatedResponse(CommentResponse, 'The customer comments, newest first.')
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  listMine(@CurrentActor('id') userId: number, @Query() query: ListCommentsQueryRequest) {
    return this.listUserCommentsUseCase.execute({
      userId,
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Post('products/:productId/comments')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['content'],
      properties: {
        content: { type: 'string', example: 'ابزار خوبی است' },
        title: { type: 'string', example: 'کیفیت عالی' },
        rate: { type: 'integer', example: 5 },
        parent_id: { type: 'integer', example: 12 },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Up to 5 images (JPEG, PNG, WebP, GIF).',
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Post a comment or reply on a product',
    description:
      'Stays hidden until an admin approves it. Send multipart/form-data to attach images. parent_id must point at a published root comment.',
  })
  @ApiParam({ name: 'productId', example: 1 })
  @ApiCreatedResponse({
    type: CommentResponse,
    description: 'Created; published is false until approved.',
  })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  @UseInterceptors(CommentImagesInterceptor)
  create(
    @CurrentActor('id') userId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: CreateCommentRequest,
    @UploadedFiles() files: Express.Multer.File[] | undefined
  ) {
    return this.createCommentUseCase.execute({
      productId,
      author: { type: 'user', userId },
      title: body.title,
      content: body.content,
      rate: body.rate,
      parentId: body.parent_id,
      files: (files ?? []).map((file) => ({
        buffer: file.buffer,
        mimeType: file.mimetype,
        originalName: file.originalname,
      })),
    })
  }

  @Delete('users/me/comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of the signed-in customer comments' })
  @ApiParam({ name: 'id', example: 9 })
  @ApiNoContentResponse({ description: 'The comment was deleted.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.FORBIDDEN,
    HttpStatus.NOT_FOUND
  )
  async remove(
    @CurrentActor('id') userId: number,
    @Param('id', ParseIntPipe) commentId: number
  ): Promise<void> {
    await this.deleteCommentUseCase.execute({ commentId, userId })
  }
}
