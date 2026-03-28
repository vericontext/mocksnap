FROM node:20-slim
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

# Copy workspace files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/api/package.json apps/api/tsconfig.json apps/api/
COPY packages/shared/package.json packages/shared/tsconfig.json packages/shared/

# Install all dependencies (including devDependencies for tsx)
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared/src packages/shared/src
COPY apps/api/src apps/api/src

RUN mkdir -p /data

ENV DATABASE_PATH=/data/mocksnap.db
ENV PORT=3001
ENV NODE_ENV=production

EXPOSE 3001

CMD ["pnpm", "--filter", "@mocksnap/api", "dev"]
