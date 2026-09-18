import { InvalidInputError } from '@shared/domain/errors'
import { ValueObject } from '@shared/domain/value-object.base'

interface ProductImageProps {
  url: string
  isThumbnail: boolean
  position: number
}

/**
 * A picture attached to a product. Images have no behaviour of their own and
 * are always replaced as a whole list, so they are values rather than
 * entities.
 */
export class ProductImage extends ValueObject<ProductImageProps> {
  private constructor(props: ProductImageProps) {
    super(props)
  }

  static create(url: string, isThumbnail: boolean, position: number): ProductImage {
    const trimmed = (url ?? '').trim()

    if (trimmed.length === 0) {
      throw new InvalidInputError('Image URL cannot be empty')
    }

    return new ProductImage({ url: trimmed, isThumbnail, position })
  }

  get url(): string {
    return this.props.url
  }

  get isThumbnail(): boolean {
    return this.props.isThumbnail
  }

  get position(): number {
    return this.props.position
  }
}
