#!/usr/bin/env bash
# Génère un certificat self-signed pour les tests locaux.
# En production EC2, utiliser plutôt Let's Encrypt (certbot) ou un cert ACM
# derrière un ALB.
set -euo pipefail

CERT_DIR="$(dirname "$0")/../nginx/certs"
mkdir -p "$CERT_DIR"

if [[ -f "$CERT_DIR/server.crt" && -f "$CERT_DIR/server.key" ]]; then
  echo "[OK] Certificats déjà présents dans $CERT_DIR"
  exit 0
fi

openssl req -x509 -nodes -newkey rsa:2048 \
  -keyout "$CERT_DIR/server.key" \
  -out    "$CERT_DIR/server.crt" \
  -days 365 \
  -subj "/C=FR/ST=Hauts-de-France/L=Lille/O=APELAV/CN=localhost" \
  -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"

chmod 600 "$CERT_DIR/server.key"
echo "[OK] Certificat self-signed généré dans $CERT_DIR"
echo "     Votre navigateur affichera un avertissement de sécurité (normal en local)."
