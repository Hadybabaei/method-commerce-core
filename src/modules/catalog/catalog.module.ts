import { Module } from '@nestjs/common'
import { IdentityModule } from '@modules/identity/identity.module'
import { AddProductVariantUseCase } from './application/use-cases/add-product-variant.use-case'
import { CreateBrandUseCase } from './application/use-cases/create-brand.use-case'
import { CreateCategoryUseCase } from './application/use-cases/create-category.use-case'
import { CreateProductUseCase } from './application/use-cases/create-product.use-case'
import { DeleteBrandUseCase } from './application/use-cases/delete-brand.use-case'
import { DeleteCategoryUseCase } from './application/use-cases/delete-category.use-case'
import { DeleteProductUseCase } from './application/use-cases/delete-product.use-case'
import { DeleteProductVariantUseCase } from './application/use-cases/delete-product-variant.use-case'
import { GetCategoryBySlugUseCase } from './application/use-cases/get-category.use-case'
import {
  GetProductByIdUseCase,
  GetProductBySlugUseCase,
} from './application/use-cases/get-product.use-case'
import {
  GetBrandBySlugUseCase,
  ListBrandsUseCase,
} from './application/use-cases/list-brands.use-case'
import { ListCategoryTreeUseCase } from './application/use-cases/list-categories.use-case'
import { ListProductsUseCase } from './application/use-cases/list-products.use-case'
import { ReplaceProductOptionsUseCase } from './application/use-cases/replace-product-options.use-case'
import { UpdateBrandUseCase } from './application/use-cases/update-brand.use-case'
import { UpdateCategoryUseCase } from './application/use-cases/update-category.use-case'
import { UpdateProductUseCase } from './application/use-cases/update-product.use-case'
import { UpdateProductVariantUseCase } from './application/use-cases/update-product-variant.use-case'
import { INVENTORY_STOCK_WRITER } from './application/ports/inventory-stock.port'
import { PRODUCT_READ_MODEL } from './application/ports/product-read.port'
import { SELLABLE_VARIANT_LOOKUP } from './application/ports/sellable-variant.port'
import { BRAND_REPOSITORY } from './domain/repositories/brand.repository'
import { CATEGORY_REPOSITORY } from './domain/repositories/category.repository'
import { PRODUCT_REPOSITORY } from './domain/repositories/product.repository'
import { PrismaInventoryStockWriter } from './infrastructure/persistence/prisma-inventory-stock.writer'
import { PrismaBrandRepository } from './infrastructure/persistence/prisma-brand.repository'
import { PrismaCategoryRepository } from './infrastructure/persistence/prisma-category.repository'
import { PrismaProductReadModel } from './infrastructure/persistence/prisma-product-read.model'
import { PrismaProductRepository } from './infrastructure/persistence/prisma-product.repository'
import { PrismaSellableVariantLookup } from './infrastructure/persistence/prisma-sellable-variant.lookup'
import { AdminBrandsController } from './presentation/controllers/admin-brands.controller'
import { AdminCategoriesController } from './presentation/controllers/admin-categories.controller'
import { AdminProductsController } from './presentation/controllers/admin-products.controller'
import { BrandsController } from './presentation/controllers/brands.controller'
import { CategoriesController } from './presentation/controllers/categories.controller'
import { ProductsController } from './presentation/controllers/products.controller'

const useCases = [
  CreateCategoryUseCase,
  UpdateCategoryUseCase,
  DeleteCategoryUseCase,
  ListCategoryTreeUseCase,
  GetCategoryBySlugUseCase,
  CreateBrandUseCase,
  UpdateBrandUseCase,
  DeleteBrandUseCase,
  ListBrandsUseCase,
  GetBrandBySlugUseCase,
  CreateProductUseCase,
  UpdateProductUseCase,
  DeleteProductUseCase,
  ReplaceProductOptionsUseCase,
  AddProductVariantUseCase,
  UpdateProductVariantUseCase,
  DeleteProductVariantUseCase,
  ListProductsUseCase,
  GetProductBySlugUseCase,
  GetProductByIdUseCase,
]

/**
 * Catalog bounded context: the category tree, brands, and the products that
 * point at them. Imports `IdentityModule` only to reuse its admin guard.
 */
@Module({
  imports: [IdentityModule],
  controllers: [
    CategoriesController,
    BrandsController,
    ProductsController,
    AdminCategoriesController,
    AdminBrandsController,
    AdminProductsController,
  ],
  providers: [
    { provide: CATEGORY_REPOSITORY, useClass: PrismaCategoryRepository },
    { provide: BRAND_REPOSITORY, useClass: PrismaBrandRepository },
    { provide: PRODUCT_REPOSITORY, useClass: PrismaProductRepository },
    { provide: PRODUCT_READ_MODEL, useClass: PrismaProductReadModel },
    { provide: SELLABLE_VARIANT_LOOKUP, useClass: PrismaSellableVariantLookup },
    { provide: INVENTORY_STOCK_WRITER, useClass: PrismaInventoryStockWriter },
    ...useCases,
  ],
  // Other contexts (favorites, basket, later cart) need to look a product or
  // sellable variant up without reaching into catalog persistence themselves.
  exports: [PRODUCT_REPOSITORY, PRODUCT_READ_MODEL, SELLABLE_VARIANT_LOOKUP],
})
export class CatalogModule {}
