FROM node:24.20.0-alpine AS builder

WORKDIR /app
ENV HUSKY=0
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk add --no-cache python3 make g++

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate
RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web
COPY packages/shared-types ./packages/shared-types

RUN pnpm --filter @isntgram-ai/shared-types build
RUN pnpm --filter web build

FROM node:24.20.0-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN apk upgrade --no-cache

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/web/package.json apps/web/
COPY packages/shared-types/package.json packages/shared-types/

RUN corepack enable && corepack prepare pnpm@9.12.3 --activate \
  && pnpm --filter web... install --prod --frozen-lockfile --ignore-scripts \
  && pnpm store prune \
  && rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx \
  && rm -rf /usr/local/lib/node_modules/corepack /usr/local/bin/corepack /usr/local/bin/pnpm /usr/local/bin/pnpx \
  && rm -rf /root/.cache/node/corepack

COPY --from=builder /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder /app/apps/web/next.config.mjs ./apps/web/next.config.mjs
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json
COPY --from=builder /app/packages/shared-types/dist ./packages/shared-types/dist

WORKDIR /app/apps/web

USER node

EXPOSE 3000

CMD ["node", "node_modules/next/dist/bin/next", "start"]
