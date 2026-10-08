// Vercel needs an output directory even though everything is served by api/index.js.
const fs = require('node:fs')
fs.mkdirSync('vercel-static', { recursive: true })
fs.writeFileSync('vercel-static/robots.txt', 'User-agent: *\nDisallow: /\n')
