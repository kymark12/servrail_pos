# Demo-oriented image: builds the POS app and serves it with `next start`.
# Reliability over image size — fine for a local demo. The database is the remote
# Neon branch, so no DB container is needed; connection strings come in at runtime.
FROM node:22-bookworm-slim

WORKDIR /app

# Prisma needs OpenSSL present on debian-slim.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install dependencies (dev deps are needed for the build).
COPY package.json package-lock.json ./
RUN npm ci

# App source (see .dockerignore — .env and secrets are NOT copied).
COPY . .

# Generate the Prisma client and build. Dummy datasource URLs (set INLINE, only for
# this RUN) satisfy schema validation at build time. They deliberately do NOT persist
# as image ENV — otherwise they'd shadow the real values the app loads from .env at
# runtime (dotenv does not override already-set process.env vars).
RUN export DATABASE_URL="postgresql://build:build@localhost:5432/build" \
    && export DIRECT_URL="postgresql://build:build@localhost:5432/build" \
    && npx prisma generate \
    && npm run build

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

# `next start` binds 0.0.0.0 so the container port is reachable.
CMD ["npm", "run", "start"]
