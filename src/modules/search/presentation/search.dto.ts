import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'
import { Transform, Type } from 'class-transformer'
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator'
import { MAX_MONEY_AMOUNT } from '@shared/domain/value-objects/money'
import { SEARCH_SORTS, SearchSort } from '../application/search.ports'
import { SearchHitView, SearchResultView, SuggestionsView } from '../application/search.use-cases'

/** Accepts `a,b` or repeated `?key=a&key=b`. */
const list = ({ value }: { value: unknown }) =>
  value === undefined
    ? undefined
    : (Array.isArray(value) ? value : [value])
        .flatMap((item) => String(item).split(','))
        .map((item) => item.trim())
        .filter(Boolean)

export class SearchRequest {
  @ApiPropertyOptional({
    example: 'دریل شارژی',
    description: 'Words; Persian spelling variants match each other.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(150)
  q?: string

  @ApiPropertyOptional({ example: 4, description: 'Includes sub-categories.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  category_id?: number

  @ApiPropertyOptional({ example: 'ابزار-برقی' })
  @IsOptional()
  @IsString()
  @MaxLength(190)
  category_slug?: string

  @ApiPropertyOptional({ example: '2,5', description: 'Any of these brands.' })
  @IsOptional()
  @Transform(({ value }) => list({ value })?.map(Number))
  @IsArray()
  @ArrayMaxSize(50)
  @IsInt({ each: true })
  brand_ids?: number[]

  @ApiPropertyOptional({ example: 'bosch', description: 'Brand slugs, comma separated.' })
  @IsOptional()
  @Transform(list)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  brand_slugs?: string[]

  @ApiPropertyOptional({
    example: 'رنگ:قرمز,رنگ:آبی,سایز:L',
    description:
      'Option values as name:value. Values of one option are OR-ed, different options AND-ed.',
  })
  @IsOptional()
  @Transform(list)
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  options?: string[]

  @ApiPropertyOptional({ description: 'Cheapest active variant, Rial.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price_min?: number

  @ApiPropertyOptional({ description: 'Cheapest active variant, Rial.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_MONEY_AMOUNT)
  price_max?: number

  @ApiPropertyOptional({ description: 'Only products with units available.' })
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === '1')
  @IsBoolean()
  in_stock?: boolean

  @ApiPropertyOptional({
    enum: SEARCH_SORTS,
    description: 'Default: relevance with words, newest without.',
  })
  @IsOptional()
  @IsIn(SEARCH_SORTS)
  sort?: SearchSort

  @ApiPropertyOptional({ default: 24, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number

  @ApiPropertyOptional({ default: 0, description: 'Rounded down to a whole page of `limit`.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(10_000)
  offset?: number
}

export class SuggestRequest {
  @ApiProperty({ example: 'دری' })
  @IsString()
  @MaxLength(100)
  q: string
}

export class RecommendationsRequest {
  @ApiPropertyOptional({ default: 8, maximum: 24 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  limit?: number
}

class RefResponse {
  @ApiProperty() id: number
  @ApiProperty() title: string
  @ApiProperty() slug: string
}

class RatingResponse {
  @ApiProperty({ example: 4.3 }) average: number
  @ApiProperty({ example: 12 }) count: number
}

export class SearchHitResponse implements SearchHitView {
  @ApiProperty() id: number
  @ApiProperty() title: string
  @ApiProperty({ nullable: true }) subTitle: string | null
  @ApiProperty() slug: string
  @ApiProperty({ nullable: true }) thumbnail: string | null
  @ApiProperty({ type: RefResponse, nullable: true }) category: RefResponse | null
  @ApiProperty({ type: RefResponse, nullable: true }) brand: RefResponse | null
  @ApiProperty({ nullable: true, description: 'Rial.' }) priceFrom: number | null
  @ApiProperty({ nullable: true, description: 'Rial.' }) priceTo: number | null
  @ApiProperty() inStock: boolean
  @ApiProperty({ type: RatingResponse, nullable: true }) rating: RatingResponse | null
  @ApiProperty() createdAt: Date
}

class NumberFacetResponse {
  @ApiProperty() value: number
  @ApiProperty() label: string
  @ApiProperty() count: number
}

class StringFacetResponse {
  @ApiProperty() value: string
  @ApiProperty() label: string
  @ApiProperty() count: number
}

class OptionFacetResponse {
  @ApiProperty({ example: 'رنگ' }) name: string
  @ApiProperty({ type: [StringFacetResponse] }) values: StringFacetResponse[]
}

class PriceRangeResponse {
  @ApiProperty() min: number
  @ApiProperty() max: number
}

class FacetsResponse {
  @ApiProperty({ type: [NumberFacetResponse], description: 'Counted as if no brand were picked.' })
  brands: NumberFacetResponse[]
  @ApiProperty({ type: [NumberFacetResponse] }) categories: NumberFacetResponse[]
  @ApiProperty({
    type: [OptionFacetResponse],
    description: 'Each counted as if none of its own values were picked.',
  })
  options: OptionFacetResponse[]
  @ApiProperty({ type: PriceRangeResponse, nullable: true }) price: PriceRangeResponse | null
}

export class SearchResponse implements SearchResultView {
  @ApiProperty({ type: [SearchHitResponse] }) items: SearchHitResponse[]
  @ApiProperty() total: number
  @ApiProperty() limit: number
  @ApiProperty() offset: number
  @ApiProperty({ type: FacetsResponse }) facets: FacetsResponse
}

class SuggestedProductResponse {
  @ApiProperty() id: number
  @ApiProperty() title: string
  @ApiProperty() slug: string
  @ApiProperty({ nullable: true }) thumbnail: string | null
  @ApiProperty({ nullable: true }) priceFrom: number | null
}

class SuggestedCategoryResponse {
  @ApiProperty() id: number
  @ApiProperty() title: string
  @ApiProperty() count: number
}

export class SuggestionsResponse implements SuggestionsView {
  @ApiProperty({ type: [SuggestedProductResponse] }) products: SuggestedProductResponse[]
  @ApiProperty({ type: [SuggestedCategoryResponse] }) categories: SuggestedCategoryResponse[]
}
