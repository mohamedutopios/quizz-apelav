#!/usr/bin/env bash
# =============================================================================
# Test de charge automatisé — Quiz APELAV
#
# Ce script automatise un test de charge réaliste :
#   1. Se connecte en admin
#   2. Active le quiz (statut 'enabled')
#   3. Lance le scénario k6 avec N participants
#   4. (optionnel) Clôture le quiz à la fin
#   5. (optionnel) Réinitialise le quiz (purge des participants de test)
#
# USAGE :
#   bash perf/run-load-test.sh [OPTIONS]
#
# OPTIONS :
#   -n, --participants N      Nombre de participants à simuler (défaut: 500)
#   -u, --url URL             URL de base (défaut: https://localhost)
#   -a, --admin USER          Username admin (défaut: admin&admin)
#   -p, --password PWD        Mot de passe admin (défaut: lit ADMIN_PASSWORD env)
#   -r, --ramp-up DURATION    Durée de montée en charge (défaut: 60s)
#   -t, --think-max SECONDS   Pause max entre 2 questions (défaut: 15)
#   --close                   Clôturer le quiz après le test
#   --reset                   Réinitialiser le quiz après le test (purge BDD)
#   --skip-activate           Ne pas activer le quiz (s'il est déjà activé)
#   -h, --help                Afficher cette aide
#
# EXEMPLES :
#   # Test 500 participants en local, réinitialisation à la fin
#   bash perf/run-load-test.sh -n 500 --reset
#
#   # Test 1000 participants contre l'EC2
#   bash perf/run-load-test.sh -n 1000 -u https://quiz.apelav.fr -p MonMotDePasse
#
#   # Test progressif : 50 → 200 → 500 → 1000
#   for n in 50 200 500 1000; do
#     bash perf/run-load-test.sh -n $n --reset
#   done
# =============================================================================
set -euo pipefail

# Valeurs par défaut
PARTICIPANTS=500
BASE_URL="https://localhost"
ADMIN_USER="admin&admin"
ADMIN_PASS=""
RAMP_UP="60s"
THINK_MAX="15"
CLOSE_AFTER=false
RESET_AFTER=false
SKIP_ACTIVATE=false

# Pour les certificats self-signed
CURL_OPTS=(-sS --max-time 15)

# Couleurs terminal (si tty)
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'
  C_BOLD=$'\033[1m'
  C_GREEN=$'\033[32m'
  C_YELLOW=$'\033[33m'
  C_RED=$'\033[31m'
  C_CYAN=$'\033[36m'
else
  C_RESET=""; C_BOLD=""; C_GREEN=""; C_YELLOW=""; C_RED=""; C_CYAN=""
fi

log()   { echo "${C_CYAN}[$(date +%H:%M:%S)]${C_RESET} $*"; }
ok()    { echo "${C_GREEN}✓${C_RESET} $*"; }
warn()  { echo "${C_YELLOW}⚠${C_RESET} $*"; }
err()   { echo "${C_RED}✗${C_RESET} $*" >&2; }
fatal() { err "$*"; exit 1; }

usage() {
  grep -E '^# ' "$0" | sed 's/^# //' | sed 's/^#$//'
  exit 0
}

# Parse des arguments
while [[ $# -gt 0 ]]; do
  case "$1" in
    -n|--participants)  PARTICIPANTS="$2"; shift 2 ;;
    -u|--url)           BASE_URL="$2"; shift 2 ;;
    -a|--admin)         ADMIN_USER="$2"; shift 2 ;;
    -p|--password)      ADMIN_PASS="$2"; shift 2 ;;
    -r|--ramp-up)       RAMP_UP="$2"; shift 2 ;;
    -t|--think-max)     THINK_MAX="$2"; shift 2 ;;
    --close)            CLOSE_AFTER=true; shift ;;
    --reset)            RESET_AFTER=true; shift ;;
    --skip-activate)    SKIP_ACTIVATE=true; shift ;;
    -h|--help)          usage ;;
    *)                  fatal "Option inconnue: $1 (utilisez --help)" ;;
  esac
done

# Mot de passe admin : .env > argument > prompt
if [[ -z "$ADMIN_PASS" ]]; then
  # Charger .env si présent
  if [[ -f .env ]]; then
    # shellcheck disable=SC1091
    ADMIN_PASS="$(grep -E '^ADMIN_PASSWORD=' .env | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'")"
  fi
fi
if [[ -z "$ADMIN_PASS" ]]; then
  read -rsp "Mot de passe admin: " ADMIN_PASS
  echo
fi

# Pour les URLs https://localhost, accepter le cert self-signed
if [[ "$BASE_URL" == *"localhost"* || "$BASE_URL" == *"127.0.0.1"* ]]; then
  CURL_OPTS+=(-k)
  K6_INSECURE="--insecure-skip-tls-verify"
else
  K6_INSECURE=""
fi

# Vérification des prérequis
log "Vérification de l'environnement…"
command -v k6 >/dev/null || fatal "k6 n'est pas installé. brew install k6 (Mac) ou voir perf/README.md"
command -v jq >/dev/null || warn "jq n'est pas installé — l'affichage des résultats sera moins joli (brew install jq)"

# Fichier cookie temporaire
COOKIE_JAR="$(mktemp -t apelav-cookies.XXXXXX)"
trap 'rm -f "$COOKIE_JAR"' EXIT

# Test de la disponibilité de l'API
log "Test de connectivité sur ${BASE_URL}…"
HTTP_CODE="$(curl "${CURL_OPTS[@]}" -o /dev/null -w '%{http_code}' "$BASE_URL/api/health" || echo "000")"
if [[ "$HTTP_CODE" != "200" ]]; then
  fatal "L'API ne répond pas correctement (HTTP $HTTP_CODE sur $BASE_URL/api/health). Vérifiez que la stack tourne (docker compose ps)."
fi
ok "API joignable (HTTP 200)"

# Connexion admin
log "Connexion admin ($ADMIN_USER)…"
LOGIN_PAYLOAD=$(printf '{"username":%s,"password":%s}' \
  "$(printf '%s' "$ADMIN_USER" | jq -Rs . 2>/dev/null || printf '"%s"' "$ADMIN_USER")" \
  "$(printf '%s' "$ADMIN_PASS" | jq -Rs . 2>/dev/null || printf '"%s"' "$ADMIN_PASS")")

LOGIN_RESP=$(curl "${CURL_OPTS[@]}" -c "$COOKIE_JAR" \
  -H 'Content-Type: application/json' \
  -d "$LOGIN_PAYLOAD" \
  "$BASE_URL/api/auth/login")
if ! echo "$LOGIN_RESP" | grep -q '"ok":true'; then
  fatal "Échec connexion admin. Réponse: $LOGIN_RESP"
fi
ok "Admin connecté"

# Activation du quiz (sauf si --skip-activate)
if [[ "$SKIP_ACTIVATE" == false ]]; then
  log "Activation du quiz…"
  STATUS_RESP=$(curl "${CURL_OPTS[@]}" -b "$COOKIE_JAR" -c "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d '{"status":"enabled"}' \
    "$BASE_URL/api/admin/status")
  if ! echo "$STATUS_RESP" | grep -q '"status":"enabled"'; then
    fatal "Échec activation. Réponse: $STATUS_RESP"
  fi
  ok "Quiz activé (statut: enabled)"
else
  log "Activation sautée (--skip-activate). Vérifiez que le quiz est déjà en 'enabled'."
fi

# Lancement du test k6
echo
echo "${C_BOLD}========================================================${C_RESET}"
echo "${C_BOLD}  LANCEMENT DU TEST DE CHARGE${C_RESET}"
echo "${C_BOLD}========================================================${C_RESET}"
echo "  Participants     : $PARTICIPANTS"
echo "  URL              : $BASE_URL"
echo "  Ramp-up          : $RAMP_UP"
echo "  Pause max/q      : ${THINK_MAX}s"
echo "  Clore après      : $CLOSE_AFTER"
echo "  Reset après      : $RESET_AFTER"
echo "${C_BOLD}========================================================${C_RESET}"
echo

# Pour les très gros tests, avertir sur les ressources locales
if [[ "$PARTICIPANTS" -gt 800 && "$BASE_URL" == *"localhost"* ]]; then
  warn "Vous lancez $PARTICIPANTS VUs depuis votre poste local."
  warn "Sur un MacBook M3, k6 peut commencer à saturer (CPU + ports éphémères)."
  warn "Idéalement, lancer ce test depuis une autre EC2 dans la même région."
  echo
  read -rp "Continuer quand même ? [y/N] " yn
  [[ "$yn" =~ ^[Yy]$ ]] || fatal "Test annulé."
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
k6 run \
  -e BASE_URL="$BASE_URL" \
  -e PARTICIPANTS="$PARTICIPANTS" \
  -e RAMP_UP="$RAMP_UP" \
  -e THINK_TIME_MAX="$THINK_MAX" \
  $K6_INSECURE \
  "$SCRIPT_DIR/perf-quiz.js"

K6_EXIT=$?
echo

if [[ $K6_EXIT -eq 0 ]]; then
  ok "Test k6 terminé sans dépasser les seuils SLO."
else
  warn "Test k6 terminé mais au moins un seuil SLO a été dépassé (voir le résumé ci-dessus)."
fi

# Statistiques côté admin
log "Récupération des statistiques côté admin…"
DASHBOARD=$(curl "${CURL_OPTS[@]}" -b "$COOKIE_JAR" "$BASE_URL/api/admin/dashboard")
if command -v jq >/dev/null; then
  echo "$DASHBOARD" | jq -r '
    "  Participants inscrits  : \(.totalUsers)
  En cours               : \(.inProgress)
  Terminés               : \(.completed)
  Encore en ligne        : \(.online)"
  '
else
  echo "$DASHBOARD"
fi

# Clôture optionnelle
if [[ "$CLOSE_AFTER" == true ]]; then
  log "Clôture du quiz…"
  curl "${CURL_OPTS[@]}" -b "$COOKIE_JAR" \
    -H 'Content-Type: application/json' \
    -d '{"status":"closed"}' \
    "$BASE_URL/api/admin/status" >/dev/null
  ok "Quiz clôturé"
fi

# Reset optionnel
if [[ "$RESET_AFTER" == true ]]; then
  echo
  warn "Reset du quiz demandé (suppression de TOUS les participants)…"
  read -rp "Confirmer la suppression des données de test ? [y/N] " yn
  if [[ "$yn" =~ ^[Yy]$ ]]; then
    RESET_RESP=$(curl "${CURL_OPTS[@]}" -b "$COOKIE_JAR" \
      -H 'Content-Type: application/json' \
      -d '{"confirm":"RESET"}' \
      "$BASE_URL/api/admin/reset")
    if command -v jq >/dev/null; then
      echo "$RESET_RESP" | jq -r '
        "  Supprimés : \(.deletedParticipants) participants · \(.deletedAttempts) tentatives · \(.deletedAnswers) réponses"
      '
    else
      echo "$RESET_RESP"
    fi
    ok "Reset effectué"
  else
    log "Reset annulé."
  fi
fi

echo
ok "Terminé. Résultats détaillés dans perf-results.json"
exit $K6_EXIT
