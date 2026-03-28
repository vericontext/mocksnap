FROM node:20-slim AS base
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src

# Build
RUN pnpm --filter @mocksnap/shared build && pnpm --filter @mocksnap/api build

# Production
FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

COPY --from=base /app/package.json /app/pnpm-workspace.yaml /app/pnpm-lock.yaml ./
COPY --from=base /app/apps/api/package.json apps/api/
COPY --from=base /app/packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=base /app/apps/api/dist apps/api/dist
COPY --from=base /app/packages/shared/dist packages/shared/dist
COPY --from=base /app/packages/shared/src packages/shared/src

RUN mkdir -p /data

ENV DATABASE_PATH=/data/mocksnap.db
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["node", "apps/api/dist/index.js"]
