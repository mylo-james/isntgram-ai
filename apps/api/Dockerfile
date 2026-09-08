FROM node:24.20.0-alpine AS builder

WORKDIR /app
ENV HUSKY=0

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
COPY packages/shared-types ./packages/shared-types

RUN pnpm --filter @isntgram-ai/shared-types build
RUN pnpm --filter api build

FROM node:24.20.0-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

RUN apk upgrade --no-cache && apk add --no-cache curl

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY packages/shared-types/package.json packages/shared-types/

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate \
  && pnpm --filter api... install --prod --frozen-lockfile --ignore-scripts \
  && pnpm store prune \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && rm -rf /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx \
  && rm -rf /root/.cache/node/corepack

COPY --from=builder /app/apps/api/dist ./apps/api/dist
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/api/health || exit 1

CMD ["node", "apps/api/dist/main.js"]
