import { ApiProperty } from '@nestjs/swagger'
import { CommentAuthorView, CommentImageView, CommentView } from '../../application/dto/views'
import { PaginationMeta } from '@shared/presentation/swagger'

export class CommentAuthorResponse implements CommentAuthorView {
  @ApiProperty({ enum: ['user', 'admin'] })
  type: 'user' | 'admin'

  @ApiProperty({ example: 4 })
  id: number

  @ApiProperty({ example: 'هادی رضایی' })
  displayName: string

  @ApiProperty({ nullable: true })
  avatarUrl: string | null
}

export class CommentImageResponse implements CommentImageView {
  @ApiProperty({ example: 'http://localhost:4000/uploads/comments/123-abc.jpg' })
  url: string

  @ApiProperty({ example: 0 })
  position: number
}

export class CommentResponse implements CommentView {
  @ApiProperty({ example: 9 })
  id: number

  @ApiProperty({ example: 1 })
  productId: number

  @ApiProperty({ nullable: true })
  title: string | null

  @ApiProperty({ example: 'ابزار خوبی است، پیشنهاد می‌کنم.' })
  content: string

  @ApiProperty({ example: 5, nullable: true })
  rate: number | null

  @ApiProperty({
    example: false,
    description: 'Customer comments start false until an admin approves them.',
  })
  published: boolean

  @ApiProperty({ example: null, nullable: true })
  parentId: number | null

  @ApiProperty({ type: CommentAuthorResponse })
  author: CommentAuthorResponse

  @ApiProperty({ type: [CommentImageResponse] })
  images: CommentImageResponse[]

  @ApiProperty({ example: '2026-09-11T17:12:16.090Z' })
  createdAt: Date

  @ApiProperty({
    type: () => [CommentResponse],
    description: 'One level of replies. Empty for a reply itself.',
  })
  replies: CommentResponse[]
}

export class PaginatedCommentsResponse extends PaginationMeta {
  @ApiProperty({ type: [CommentResponse] })
  items: CommentResponse[]
}
