import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
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
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger'
import { AdminAuthGuard } from '@modules/identity/presentation/guards/admin-auth.guard'
import { CurrentActor } from '@shared/presentation/decorators/current-actor.decorator'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { CreateCommentUseCase } from '../../application/use-cases/create-comment.use-case'
import { DeleteCommentUseCase } from '../../application/use-cases/delete-comment.use-case'
import {
  ListPendingCommentsUseCase,
  ListProductCommentsUseCase,
} from '../../application/use-cases/list-comments.use-case'
import { ModerateCommentUseCase } from '../../application/use-cases/moderate-comment.use-case'
import {
  CreateCommentRequest,
  ListCommentsQueryRequest,
  ModerateCommentRequest,
} from '../dto/comment.request'
import { CommentResponse } from '../dto/comment.response'
import { CommentImagesInterceptor } from '../interceptors/comment-images.interceptor'

@ApiTags('Admin comments')
@ApiBearerAuth('admin')
@UseGuards(AdminAuthGuard)
@Controller('admin')
export class AdminCommentsController {
  constructor(
    private readonly createCommentUseCase: CreateCommentUseCase,
    private readonly moderateCommentUseCase: ModerateCommentUseCase,
    private readonly deleteCommentUseCase: DeleteCommentUseCase,
    private readonly listProductCommentsUseCase: ListProductCommentsUseCase,
    private readonly listPendingCommentsUseCase: ListPendingCommentsUseCase
  ) {}

  @Get('comments/pending')
  @ApiOperation({
    summary: 'Moderation queue',
    description: 'Customer comments (and replies) waiting for approval, oldest first.',
  })
  @ApiPaginatedResponse(CommentResponse, 'Unpublished comments.')
  @ApiErrorResponses(HttpStatus.UNAUTHORIZED)
  listPending(@Query() query: ListCommentsQueryRequest) {
    return this.listPendingCommentsUseCase.execute({
      limit: query.limit,
      offset: query.offset,
    })
  }

  @Get('products/:productId/comments')
  @ApiOperation({
    summary: 'List every comment on a product',
    description: 'Includes unpublished roots and replies, for the moderation panel.',
  })
  @ApiParam({ name: 'productId', example: 1 })
  @ApiPaginatedResponse(CommentResponse, 'All comments on the product.')
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  listForProduct(
    @Param('productId', ParseIntPipe) productId: number,
    @Query() query: ListCommentsQueryRequest
  ) {
    return this.listProductCommentsUseCase.execute({
      productId,
      publishedOnly: false,
      includeUnpublishedReplies: true,
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
        content: { type: 'string', example: 'با سپاس از بازخورد شما' },
        title: { type: 'string' },
        rate: { type: 'integer', example: 5 },
        parent_id: {
          type: 'integer',
          example: 9,
          description: 'Set this to reply as method-commerce on a customer comment.',
        },
        images: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
        },
      },
    },
  })
  @ApiOperation({
    summary: 'Post an admin comment or reply',
    description: 'Published immediately. Use parent_id to reply under a customer comment.',
  })
  @ApiParam({ name: 'productId', example: 1 })
  @ApiCreatedResponse({ type: CommentResponse, description: 'Published right away.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.UNPROCESSABLE_ENTITY
  )
  @UseInterceptors(CommentImagesInterceptor)
  create(
    @CurrentActor('id') adminId: number,
    @Param('productId', ParseIntPipe) productId: number,
    @Body() body: CreateCommentRequest,
    @UploadedFiles() files: Express.Multer.File[] | undefined
  ) {
    return this.createCommentUseCase.execute({
      productId,
      author: { type: 'admin', adminId },
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

  @Patch('comments/:id/approval')
  @ApiOperation({
    summary: 'Approve or hide a comment',
    description: 'Only published comments appear on the storefront.',
  })
  @ApiParam({ name: 'id', example: 9 })
  @ApiOkResponse({ type: CommentResponse, description: 'The comment after moderation.' })
  @ApiErrorResponses(
    HttpStatus.BAD_REQUEST,
    HttpStatus.UNAUTHORIZED,
    HttpStatus.NOT_FOUND,
    HttpStatus.CONFLICT
  )
  moderate(@Param('id', ParseIntPipe) commentId: number, @Body() body: ModerateCommentRequest) {
    return this.moderateCommentUseCase.execute({
      commentId,
      published: body.published,
    })
  }

  @Delete('comments/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete any comment' })
  @ApiParam({ name: 'id', example: 9 })
  @ApiNoContentResponse({ description: 'The comment was deleted.' })
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.UNAUTHORIZED, HttpStatus.NOT_FOUND)
  async remove(@Param('id', ParseIntPipe) commentId: number): Promise<void> {
    await this.deleteCommentUseCase.execute({ commentId })
  }
}
