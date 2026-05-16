# syntax=docker/dockerfile:1.6
# Reverse proxy : copie le build frontend + la conf durcie
FROM nginx:1.27-alpine

# Outils minimum
RUN apk add --no-cache curl openssl

# Conf
COPY nginx.conf         /etc/nginx/nginx.conf
COPY proxy_params.conf  /etc/nginx/proxy_params.conf

# Le contenu /usr/share/nginx/html sera monté en volume depuis l'image frontend
# (via docker compose volume from). On laisse vide ici.

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD curl -fsS http://localhost/health || exit 1
