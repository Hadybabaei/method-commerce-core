import { registerAs } from '@nestjs/config'
import { toBool, toInt } from './parsers'

export const searchConfig = registerAs('search', () => {
  const url = process.env.MEILISEARCH_URL?.trim() || null
  return {
    /** With no Meilisearch URL, products are searched in memory (fine for small stores and tests). */
    driver: url ? ('meilisearch' as const) : ('memory' as const),
    meilisearch: {
      url: url ?? '',
      apiKey: process.env.MEILISEARCH_API_KEY?.trim() || null,
      index: process.env.MEILISEARCH_INDEX?.trim() || 'products',
    },
    /** Rebuild the whole index on start-up (always on for the in-memory engine). */
    reindexOnBoot: toBool(process.env.SEARCH_REINDEX_ON_BOOT, true),
    /**
     * Full rebuild every N minutes as a safety net for changes no event
     * reports (stock reserved by orders, sales counts); 0 turns it off.
     */
    refreshMinutes: toInt(process.env.SEARCH_REFRESH_MINUTES, 15),
  }
})

export type SearchConfig = ReturnType<typeof searchConfig>
