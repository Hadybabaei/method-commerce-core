/**
 * Prisma unique-violation helper. Also matches in-memory doubles that set
 * `{ code: 'P2002', meta: { target: [...] } }` so use-case retries work in tests.
 */
export function isUniqueConstraintError(error: unknown, field?: string): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }

  const candidate = error as { code?: string; meta?: { target?: unknown } }
  if (candidate.code !== 'P2002') {
    return false
  }

  if (!field) {
    return true
  }

  const target = candidate.meta?.target
  if (Array.isArray(target)) {
    return target.includes(field)
  }
  if (typeof target === 'string') {
    return target.includes(field)
  }

  return true
}
