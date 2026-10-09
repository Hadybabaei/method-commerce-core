// Bundles the compiled API (dist/serverless.js) into one CommonJS file for
// Vercel. NestJS 12 ships ES modules, and Vercel's function loader cannot
// require() them from CommonJS the way Node 22+ can, so they are bundled in.
// Prisma stays external (its engine is loaded from node_modules at runtime),
// and optional packages Nest probes for but this API does not install are left
// as runtime requires that fail softly, exactly as without bundling.
import { build } from 'esbuild'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ALWAYS_EXTERNAL = ['@prisma/client', '.prisma/client', '@prisma/engines', 'sharp']

/** Leaves modules that cannot be resolved (optional peers) as plain requires. */
const optionalPeers = {
  name: 'optional-peers',
  setup(build) {
    build.onResolve({ filter: /^[^./]/ }, (args) => {
      if (args.kind === 'entry-point') return null
      try {
        require.resolve(args.path, { paths: [args.resolveDir] })
        return null
      } catch {
        try {
          // Packages that only expose an "import" condition still resolve here.
          import.meta.resolve(args.path)
          return null
        } catch {
          return { path: args.path, external: true }
        }
      }
    })
  },
}

await build({
  entryPoints: ['dist/serverless.js'],
  outfile: 'dist-bundle/serverless.cjs',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'cjs',
  // Nest reads class and function names (logger contexts, injection tokens).
  keepNames: true,
  sourcemap: false,
  external: ALWAYS_EXTERNAL,
  plugins: [optionalPeers],
  // ES modules converted to CommonJS lose import.meta: give them a real file URL.
  define: { 'import.meta.url': '__import_meta_url' },
  banner: { js: "const __import_meta_url = require('node:url').pathToFileURL(__filename).href;" },
  logLevel: 'warning',
})
console.log('Bundled dist-bundle/serverless.cjs')
