import { Inject, Injectable } from '@nestjs/common'
import { EVENT_PUBLISHER, EventPublisher } from '@shared/application/ports/event-publisher.port'
import {
  PrismaService,
  PrismaTransaction,
} from '@shared/infrastructure/persistence/prisma/prisma.service'
import { Category, PathRewrite } from '../../domain/entities/category.aggregate'
import { CategoryRepository } from '../../domain/repositories/category.repository'
import { CategoryRecord, toCategoryWriteData, toDomainCategory } from './mappers/category.mapper'

@Injectable()
export class PrismaCategoryRepository implements CategoryRepository {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(EVENT_PUBLISHER) private readonly events: EventPublisher
  ) {}

  async findById(id: number): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { id } })

    return record ? toDomainCategory(record) : null
  }

  async findBySlug(slug: string): Promise<Category | null> {
    const record = await this.prisma.category.findUnique({ where: { slug } })

    return record ? toDomainCategory(record) : null
  }

  async findAll(): Promise<Category[]> {
    const records = await this.prisma.category.findMany({
      orderBy: [{ depth: 'asc' }, { position: 'asc' }, { id: 'asc' }],
    })

    return records.map(toDomainCategory)
  }

  async findSubtreeIds(category: Category): Promise<number[]> {
    const records = await this.prisma.category.findMany({
      where: {
        OR: [{ id: category.id }, { path: { startsWith: category.subtreePrefix } }],
      },
      select: { id: true },
    })

    return records.map((record) => record.id)
  }

  async findDeepestDescendantDepth(category: Category): Promise<number> {
    const result = await this.prisma.category.aggregate({
      _max: { depth: true },
      where: { path: { startsWith: category.subtreePrefix } },
    })

    return result._max.depth ?? category.depth
  }

  countChildren(id: number): Promise<number> {
    return this.prisma.category.count({ where: { parentId: id } })
  }

  countProducts(id: number): Promise<number> {
    return this.prisma.product.count({ where: { categoryId: id } })
  }

  async existsBySlug(slug: string, excludeId?: number): Promise<boolean> {
    const found = await this.prisma.category.findFirst({
      where: { slug, ...(excludeId === undefined ? {} : { id: { not: excludeId } }) },
      select: { id: true },
    })

    return found !== null
  }

  async save(category: Category, pathRewrite?: PathRewrite | null): Promise<Category> {
    const record = await this.prisma.$transaction(async (tx) => {
      const saved = category.isNew
        ? await tx.category.create({ data: toCategoryWriteData(category) })
        : await tx.category.update({
            where: { id: category.id },
            data: toCategoryWriteData(category),
          })

      if (pathRewrite) {
        await this.rewriteDescendantPaths(tx, pathRewrite)
      }

      return saved
    })

    await this.events.publish(category.pullDomainEvents())

    return toDomainCategory(record as CategoryRecord)
  }

  async delete(id: number): Promise<void> {
    await this.prisma.category.delete({ where: { id } })
  }

  /**
   * Moves a whole subtree with one statement by rewriting the shared prefix of
   * its stored paths. The depth shifts by the difference in prefix depth,
   * which is the same for every node because the subtree keeps its shape.
   */
  private async rewriteDescendantPaths(
    tx: PrismaTransaction,
    { oldPrefix, newPrefix }: PathRewrite
  ): Promise<void> {
    const depthDelta = segmentCount(newPrefix) - segmentCount(oldPrefix)

    await tx.$executeRaw`
      UPDATE category
      SET path = CONCAT(${newPrefix}, SUBSTRING(path, ${oldPrefix.length + 1})),
          depth = depth + ${depthDelta}
      WHERE path LIKE ${`${oldPrefix}%`}
    `
  }
}

function segmentCount(path: string): number {
  return path.split('/').filter((segment) => segment.length > 0).length
}
