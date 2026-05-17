# Test de performance — Quiz APELAV

Test de charge réaliste simulant **N participants** (configurable) effectuant le quiz simultanément, du `register` au `submit`.

## TL;DR — Lancer un test en une commande

```bash
# 500 participants en local
bash perf/run-load-test.sh -n 500

# 1000 participants contre l'EC2, avec reset à la fin
bash perf/run-load-test.sh -n 1000 -u https://quiz.apelav.fr --reset
```

Le script fait **tout** automatiquement : connexion admin → activation du quiz → lancement k6 → affichage des stats → reset optionnel.

---

## Installation de k6 (une seule fois)

**macOS :**
```bash
brew install k6 jq
```

**Amazon Linux 2023 / Fedora :**
```bash
sudo dnf install -y https://dl.k6.io/rpm/repo.rpm
sudo dnf install -y k6 jq
```

**Vérification :**
```bash
k6 version
```

---

## Le script `run-load-test.sh` : workflow automatisé

C'est la façon **recommandée** de lancer un test. Il enchaîne :

1. Vérifie que l'API répond
2. Se connecte en admin
3. Active le quiz (`status = enabled`)
4. Lance k6 avec le nombre de participants demandé
5. Affiche les stats côté admin à la fin
6. (optionnel) Clôture le quiz
7. (optionnel) Réinitialise (purge des participants de test)

### Options disponibles

| Flag | Valeur défaut | Description |
| ---- | ------------- | ----------- |
| `-n, --participants N` | 500 | Nombre de participants simultanés |
| `-u, --url URL` | https://localhost | URL de base de l'application |
| `-a, --admin USER` | admin&admin | Username admin |
| `-p, --password PWD` | (lit `.env` ou demande) | Mot de passe admin |
| `-r, --ramp-up DURATION` | 60s | Durée d'arrivée échelonnée des participants |
| `-t, --think-max SECONDS` | 15 | Temps max de réflexion par question |
| `--close` | off | Clôturer le quiz à la fin du test |
| `--reset` | off | Purger les participants de test à la fin |
| `--skip-activate` | off | Ne pas activer (s'il est déjà en `enabled`) |

### Exemples concrets

```bash
# Test progressif : valider que ça marche avant de monter
bash perf/run-load-test.sh -n 20  -r 10s -t 1
bash perf/run-load-test.sh -n 100 -r 30s
bash perf/run-load-test.sh -n 500
bash perf/run-load-test.sh -n 1000 --reset

# Test "stress" : 500 utilisateurs qui répondent vite (pas de pause)
bash perf/run-load-test.sh -n 500 -t 1 --reset

# Test contre l'EC2 (URL et mot de passe explicites)
bash perf/run-load-test.sh -n 1000 \
  -u https://quiz.apelav.fr \
  -p 'MonMotDePasseFort!2026' \
  --close --reset

# Plusieurs tests dans la foulée, reset entre chaque
for n in 50 200 500 1000; do
  echo "=== Test avec $n participants ==="
  bash perf/run-load-test.sh -n $n --reset
done
```

---

## Utilisation directe de k6 (sans le script bash)

Si vous voulez contrôler manuellement (utile pour intégrer en CI), invoquez k6 directement.

⚠️ **Le quiz doit être activé** (`status='enabled'`) AVANT le test. Sinon les VUs reçoivent HTTP 423 sur `/api/quiz/start`. Le script bash le fait pour vous, mais en lancement direct, activez-le manuellement depuis l'admin (`▶ Démarrer le quiz`).

```bash
# 500 VUs en local
cd perf
k6 run \
  -e PARTICIPANTS=500 \
  -e BASE_URL=https://localhost \
  --insecure-skip-tls-verify \
  perf-quiz.js

# 1000 VUs contre l'EC2
k6 run \
  -e PARTICIPANTS=1000 \
  -e BASE_URL=https://quiz.apelav.fr \
  perf-quiz.js

# Test rapide (50 VUs, sans pauses)
k6 run \
  -e PARTICIPANTS=50 \
  -e THINK_TIME_MIN=0 \
  -e THINK_TIME_MAX=1 \
  -e BASE_URL=https://localhost \
  --insecure-skip-tls-verify \
  perf-quiz.js
```

### Variables d'environnement reconnues par `perf-quiz.js`

| Variable | Défaut | Description |
| -------- | ------ | ----------- |
| `BASE_URL` | https://localhost | URL de l'application |
| `PARTICIPANTS` | 500 | Nombre de VUs (chaque VU = un participant qui fait UN quiz) |
| `RAMP_UP` | 60s | Étalement de l'arrivée des participants |
| `THINK_TIME_MIN` | 3 | Pause min entre 2 questions (secondes) |
| `THINK_TIME_MAX` | 15 | Pause max entre 2 questions (secondes) |

---

## Interprétation des résultats

À la fin du test, vous verrez un récapitulatif :

```
================================================================
 TEST DE CHARGE QUIZ APELAV — RÉSUMÉ
================================================================
 Participants simulés       : 500
 URL cible                  : https://localhost
 Durée totale du test       : 432.1s
----------------------------------------------------------------
 Taux de succès par étape :
   - Inscription            : 99.8%
   - Connexion              : 100.0%
   - Démarrage quiz         : 100.0%
   - Soumission finale      : 99.2%
----------------------------------------------------------------
 Latence HTTP (ms) :
   - médiane (p50)          : 42.18
   - 95e percentile         : 287.50
   - 99e percentile         : 854.20
   - max                    : 2103.00
----------------------------------------------------------------
 Requêtes :
   - Total                  : 11820
   - Erreurs HTTP           : 0.3%
   - Erreurs applicatives   : 12
----------------------------------------------------------------
 Durée parcours complet (inscription → submit) :
   - médiane (p50)          : 168042 ms
   - 95e percentile         : 215380 ms
================================================================
```

### Métriques clés à surveiller

| Métrique | Seuil cible | Que faire si dépassé |
| -------- | ----------- | -------------------- |
| `Inscription` | > 95% | Vérifier que le rate-limit n'est pas trop strict, augmenter `RAMP_UP` |
| `Soumission finale` | > 90% | Indique des erreurs critiques, regarder les logs backend |
| `p(95) latence` | < 1500 ms | Backend saturé : monter en gamme EC2 ou réduire `BCRYPT_COST` |
| `p(99) latence` | < 3000 ms | Idem |
| `Erreurs HTTP` | < 5% | Si 5xx → backend en surcharge ; si 429 → rate-limit nginx trop strict |

### Rapport JSON détaillé

Le test produit aussi un fichier `perf-results.json` dans le répertoire courant, avec **toutes** les métriques k6 brutes (utile pour générer des graphiques ou archiver).

---

## Dimensionnement EC2

Le facteur limitant principal est **bcrypt à l'inscription** (`BCRYPT_COST=12` ≈ 250 ms de CPU par hash). Recommandations selon le nombre de participants visés :

| Participants visés | Instance recommandée | vCPU | RAM | Note |
| ------------------ | -------------------- | ---- | --- | ---- |
| 100               | `t3.small`           | 2    | 2G  | OK pour test |
| 300               | `t3.medium`          | 2    | 4G  | Activez `t3.unlimited` pour éviter le throttling CPU |
| **500**           | **`t3.large`**       | 2    | 8G  | **Minimum recommandé pour le 23 mai** |
| 1000              | `t3.xlarge` ou `m6i.large` | 4 | 16G | Confortable |
| 2000+             | `m6i.xlarge`         | 4    | 16G | Considérer de baisser `BCRYPT_COST` à 11 |

**Conseils pratiques :**

- Les inscriptions concentrent la charge CPU bcrypt. À 500 users s'inscrivant en 2 minutes → ~ 4 hashes/sec, OK pour 2 vCPU.
- Si vous attendez un pic d'inscriptions en quelques secondes, augmentez le ramp-up applicatif (les participants arrivent naturellement étalés dans la vraie vie).
- MySQL : un pool de 40 connexions backend + `max_connections=300` côté MySQL est largement dimensionné pour 1000 participants.
- Redis : ~128 MB suffisent (présence + rate-limit en O(N)).

---

## Limites du test depuis votre poste local

⚠️ **Ne lancez pas 1000 VUs depuis votre MacBook** directement. k6 sature votre poste (CPU + ports éphémères + sockets TLS) et **fausse les mesures**. Vous mesurerez votre poste, pas l'EC2.

Pipeline recommandé :

1. **Sur MacBook** : `bash perf/run-load-test.sh -n 50` pour valider le scénario fonctionnel
2. **Sur MacBook** : `bash perf/run-load-test.sh -n 100` pour un premier ordre de grandeur
3. **Sur une 2e EC2 dans la même région** : `bash perf/run-load-test.sh -n 500 -u https://quiz.apelav.fr` pour la vraie mesure
4. **Sur une 2e EC2** : `bash perf/run-load-test.sh -n 1000 -u https://quiz.apelav.fr --reset` si vous voulez stresser

Pour la 2e EC2 de test, une `c6i.large` (2 vCPU, dédiés au compute) suffit.

---

## Goulots d'étranglement identifiés

D'après l'architecture :

1. **bcrypt (CPU)** lors du `register` et du `login` — c'est de loin le facteur limitant. Mitigé par : étalement temporel des arrivées, ou réduction de `BCRYPT_COST` (11 reste sûr, 10 = à éviter pour la prod).
2. **Lock MySQL sur `quiz_attempts`** à `startOrResumeAttempt` (transaction + `FOR UPDATE`). Très court (~5 ms) — pas un souci à 1000 concurrents.
3. **Bande passante TLS** sortante : un round du quiz (~50 KB) × 500 users × ~25 round-trips ≈ 600 MB sur 10 min. Une EC2 small/medium suffit.
4. **Rate-limit nginx** : 10 r/s par IP. Si vous testez depuis une seule IP, vous atteindrez vite cette limite. Le script étale les requêtes via `RAMP_UP` pour éviter ça.

---

## Reset propre entre deux runs

Le script `run-load-test.sh --reset` s'en occupe. En manuel :

```bash
# Via le dashboard admin : Vue d'ensemble → Zone dangereuse → "🗑 Réinitialiser le quiz"

# Ou en SQL direct
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" apelav_quizz -e "
  DELETE FROM users WHERE nom LIKE 'Load%' AND prenom LIKE 'Test%';
"
# Les attempt_answers et quiz_attempts partent en cascade via les FK.
```

Le préfixe `Load` / `Test` des utilisateurs créés par k6 permet de les distinguer des vrais participants si jamais le test est lancé sur un environnement partagé (mais évitez cette pratique).
