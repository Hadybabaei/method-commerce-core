import { ProductImage } from '../../domain/value-objects/product-image.vo'
import { ProductImageCommand } from '../dto/commands'

/**
 * Turns the submitted image list into value objects. The first image is the
 * thumbnail unless one is marked explicitly, so a product always has something
 * to show in a listing.
 */
export function toProductImages(images: ProductImageCommand[] | undefined): ProductImage[] {
  if (!images || images.length === 0) {
    return []
  }

  const hasExplicitThumbnail = images.some((image) => image.thumbnail === true)

  return images.map((image, index) =>
    ProductImage.create(
      image.url,
      hasExplicitThumbnail ? image.thumbnail === true : index === 0,
      index
    )
  )
}
