# ── Build stage ───────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS build
WORKDIR /app

# better-sqlite3 may need to compile a native addon.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ── Runtime stage ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

# Persisted SQLite data lives here; mount a volume to keep custom units.
RUN mkdir -p /app/data
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
