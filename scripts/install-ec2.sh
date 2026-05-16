#!/usr/bin/env bash
# =============================================================================
# Installation de Docker + Docker Compose sur Amazon Linux 2023 pour APELAV
# Usage : sudo bash install-ec2.sh
# =============================================================================
set -euo pipefail

if [[ $EUID -ne 0 ]]; then
  echo "[ERREUR] Ce script doit être lancé en root (sudo bash $0)"
  exit 1
fi

echo "==> Mise à jour du système"
dnf update -y

echo "==> Installation des outils de base"
dnf install -y docker git tar gzip openssl curl

echo "==> Activation de Docker au boot"
systemctl enable --now docker

echo "==> Ajout de ec2-user au groupe docker"
usermod -aG docker ec2-user || true

echo "==> Installation du plugin docker-compose v2"
DOCKER_PLUGIN_DIR="/usr/libexec/docker/cli-plugins"
mkdir -p "$DOCKER_PLUGIN_DIR"
COMPOSE_VERSION="v2.29.7"
ARCH="$(uname -m)"
case "$ARCH" in
  x86_64)  COMPOSE_ARCH="x86_64" ;;
  aarch64) COMPOSE_ARCH="aarch64" ;;
  *)       echo "[ERREUR] Architecture non supportée: $ARCH"; exit 1 ;;
esac

curl -fsSL -o "$DOCKER_PLUGIN_DIR/docker-compose" \
  "https://github.com/docker/compose/releases/download/${COMPOSE_VERSION}/docker-compose-linux-${COMPOSE_ARCH}"
chmod +x "$DOCKER_PLUGIN_DIR/docker-compose"

docker --version
docker compose version

echo ""
echo "============================================================="
echo "  Installation terminée"
echo "============================================================="
echo ""
echo "Prochaines étapes :"
echo "  1. Reconnectez-vous (logout/login) pour appliquer le groupe docker"
echo "     OU lancez : newgrp docker"
echo ""
echo "  2. Clonez le projet :"
echo "     git clone <repo> apelav-quizz && cd apelav-quizz"
echo ""
echo "  3. Configurez l'environnement :"
echo "     cp .env.example .env  &&  nano .env"
echo "     (changez JWT_SECRET, mots de passe, CORS_ORIGIN)"
echo ""
echo "  4. Générez le certificat TLS :"
echo "     bash scripts/gen-cert.sh"
echo "     (ou utilisez Let's Encrypt / ALB+ACM en prod)"
echo ""
echo "  5. Lancez la stack :"
echo "     docker compose up --build -d"
echo ""
echo "  6. Security Group EC2 à ouvrir :"
echo "     - 80   (HTTP, pour redirection → HTTPS)"
echo "     - 443  (HTTPS, public)"
echo "     - 22   (SSH, restreint à votre IP uniquement)"
echo ""
