import { SlugRedirectType } from '@prisma/client'
import { PrismaTransaction } from '@shared/infrastructure/persistence/prisma/prisma.service'

export { SlugRedirectType }

/** The slug stored right now, read inside the save transaction before it is overwritten. */
export async function currentSlug(
  tx: PrismaTransaction,
  type: SlugRedirectType,
  id: number
): Promise<string | null> {
  const where = { where: { id }, select: { slug: true } }
  const record =
    type === SlugRedirectType.PRODUCT
      ? await tx.product.findUnique(where)
      : type === SlugRedirectType.CATEGORY
        ? await tx.category.findUnique(where)
        : await tx.brand.findUnique(where)
  return record?.slug ?? null
}

/**
 * Keeps old links working after a slug change. A slug that is live again (the
 * same entry renamed back, or a new entry taking it) stops redirecting, and
 * the old slug points at the entry's id so later renames need no rewrite.
 */
export async function recordSlugChange(
  tx: PrismaTransaction,
  type: SlugRedirectType,
  targetId: number,
  previousSlug: string | null,
  nextSlug: string
): Promise<void> {
  await tx.slug_redirect.deleteMany({ where: { type, old_slug: nextSlug } })

  if (previousSlug === null || previousSlug === nextSlug) {
    return
  }

  await tx.slug_redirect.upsert({
    where: { type_old_slug: { type, old_slug: previousSlug } },
    create: { type, old_slug: previousSlug, targetId },
    update: { targetId },
  })
}
