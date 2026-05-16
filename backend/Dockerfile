# syntax=docker/dockerfile:1.6
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
# tini pour la gestion propre des signaux
RUN apk add --no-cache tini curl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# User non-root
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app
USER app

EXPOSE 4000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -fsS http://localhost:4000/api/health || exit 1

ENTRYPOINT ["/sbin/tini","--"]
# Le seed admin tourne avant le start (idempotent)
CMD ["sh","-c","node src/scripts/seed-admin.js && node src/server.js"]
