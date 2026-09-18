# syntax=docker/dockerfile:1

# method-commerce API: NestJS + Prisma
# Stages: deps → build → runner (production, non-root)

FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# ---- install all dependencies (cached unless lockfile/schema change) ----
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# schema reads DATABASE_URL at generate time; no live database is required
ENV DATABASE_URL="mysql://build:build@127.0.0.1:3306/build"
RUN npm install --no-audit --no-fund

# ---- compile Nest and generate the Prisma client ----
FROM deps AS build
COPY nest-cli.json tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npx prisma generate && npm run build \
  && npm prune --omit=dev \
  && npm install prisma@6.19.3 --omit=dev --no-save --ignore-scripts

# ---- runtime: compiled JS, production node_modules, Prisma CLI for migrate ----
FROM base AS runner
ENV NODE_ENV=production \
    PORT=4000 \
    API_PREFIX=api

RUN addgroup -S nodejs && adduser -S nestjs -G nodejs \
  && mkdir -p /app/uploads /app/logs \
  && chown -R nestjs:nodejs /app

COPY --from=build --chown=nestjs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nestjs:nodejs /app/dist ./dist
COPY --from=build --chown=nestjs:nodejs /app/prisma ./prisma
COPY --from=build --chown=nestjs:nodejs /app/package.json ./

USER nestjs
EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=25s --retries=3 \
  CMD node -e "const p=process.env.PORT||4000; const a=process.env.API_PREFIX||'api'; fetch('http://127.0.0.1:'+p+'/'+a+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Apply pending migrations, then start. Override CMD to skip migrate if needed.
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main.js"]
