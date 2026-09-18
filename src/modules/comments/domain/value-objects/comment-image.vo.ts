import { ValueObject } from '@shared/domain/value-object.base'
import { InvalidInputError } from '@shared/domain/errors'

interface CommentImageProps {
  url: string
  position: number
}

export class CommentImage extends ValueObject<CommentImageProps> {
  private constructor(props: CommentImageProps) {
    super(props)
  }

  static create(url: string, position: number): CommentImage {
    const trimmed = url?.trim() ?? ''
    if (!trimmed) {
      throw new InvalidInputError('A comment image needs a URL')
    }
    if (!Number.isInteger(position) || position < 0) {
      throw new InvalidInputError('A comment image position must be a non-negative integer')
    }

    return new CommentImage({ url: trimmed, position })
  }

  get url(): string {
    return this.props.url
  }

  get position(): number {
    return this.props.position
  }
}
