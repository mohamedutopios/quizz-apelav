# syntax=docker/dockerfile:1.6
# ---- Build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install --no-audit --no-fund
COPY . .
RUN npm run build

# ---- Runtime : nginx servira les fichiers via le reverse proxy parent.
# Cette image n'expose qu'un volume read-only.
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
# Healthcheck simple
HEALTHCHECK --interval=30s --timeout=5s CMD wget --no-verbose --tries=1 --spider http://localhost/ || exit 1
