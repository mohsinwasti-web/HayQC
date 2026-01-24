# Build stage
FROM oven/bun:1 AS base
WORKDIR /app

# Install dependencies
FROM base AS install
COPY package.json bun.lock ./
COPY prisma ./prisma/
RUN bun install --frozen-lockfile
RUN bunx prisma generate

# Production stage
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY --from=install /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

# Set environment
ENV NODE_ENV=production
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Run the application
CMD ["bun", "run", "src/index.ts"]
