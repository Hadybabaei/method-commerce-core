import { Inject, Injectable } from '@nestjs/common'
import { UseCase } from '@shared/application/use-case'
import { NotFoundError } from '@shared/domain/errors'
import {
  CATALOG_SEO_READ_MODEL,
  CatalogEntryType,
  CatalogSeoReadModel,
  SitemapView,
} from '../ports/catalog-seo-read.port'

export class SlugRedirectNotFoundError extends NotFoundError {
  constructor(type: CatalogEntryType, slug: string) {
    super('No redirect for this slug', { type, slug })
  }
}

export interface SlugRedirectView {
  type: CatalogEntryType
  /** The entry's current slug; link here with a permanent redirect. */
  slug: string
}

@Injectable()
export class ResolveSlugRedirectUseCase implements UseCase<
  { type: CatalogEntryType; slug: string },
  SlugRedirectView
> {
  constructor(@Inject(CATALOG_SEO_READ_MODEL) private readonly seo: CatalogSeoReadModel) {}

  async execute({
    type,
    slug,
  }: {
    type: CatalogEntryType
    slug: string
  }): Promise<SlugRedirectView> {
    const current = await this.seo.resolveRedirect(type, slug)
    if (!current) {
      throw new SlugRedirectNotFoundError(type, slug)
    }
    return { type, slug: current }
  }
}

@Injectable()
export class GetSitemapUseCase implements UseCase<void, SitemapView> {
  constructor(@Inject(CATALOG_SEO_READ_MODEL) private readonly seo: CatalogSeoReadModel) {}

  execute(): Promise<SitemapView> {
    return this.seo.sitemap()
  }
}
