import { Controller, Get, HttpStatus, Param, Query } from '@nestjs/common'
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger'
import { ApiErrorResponses, ApiPaginatedResponse } from '@shared/presentation/swagger'
import { ListProductCommentsUseCase } from '../../application/use-cases/list-comments.use-case'
import { ListCommentsQueryRequest } from '../dto/comment.request'
import { CommentResponse } from '../dto/comment.response'

/** Storefront: only published comments and published replies. */
@ApiTags('Comments')
@Controller('products')
export class ProductCommentsController {
  constructor(private readonly listProductCommentsUseCase: ListProductCommentsUseCase) {}

  @Get(':slug/comments')
  @ApiOperation({
    summary: 'List published comments for a product',
    description:
      'Roots come newest first. Customer comments appear only after an admin approves them. Replies are nested one level deep.',
  })
  @ApiParam({ name: 'slug', example: 'دریل-شارژی-بوش' })
  @ApiPaginatedResponse(CommentResponse, 'A page of published comments.')
  @ApiErrorResponses(HttpStatus.BAD_REQUEST, HttpStatus.NOT_FOUND)
  list(@Param('slug') slug: string, @Query() query: ListCommentsQueryRequest) {
    return this.listProductCommentsUseCase.execute({
      productSlug: slug,
      publishedOnly: true,
      includeUnpublishedReplies: false,
      limit: query.limit,
      offset: query.offset,
    })
  }
}
