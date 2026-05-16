# Test de performance — Quiz APELAV (500 utilisateurs)

Test de charge réaliste simulant 500 participants simultanés sur le quiz, du `register` au `submit`.

> ⚠️ **Prérequis** : le quiz doit être **activé** par l'admin avant le test (onglet Vue d'ensemble → « ▶ Démarrer le quiz »). Sinon les VUs reçoivent un HTTP 423 sur `/api/quiz/start` et le test échoue.

## Installation de k6

**macOS :**
```bash
brew install k6
```

**Amazon Linux 2023 / Fedora :**
```bash
sudo dnf install -y https://dl.k6.io/rpm/repo.rpm
sudo dnf install -y k6
```

**Vérification :**
```bash
k6 version
```

## Lancement

### Contre la stack locale (cert self-signed)
```bash
cd perf
k6 run -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
```

### Contre l'EC2 en production
```bash
k6 run -e BASE_URL=https://quiz.votre-domaine.fr perf-quiz.js
```

### Test plus léger (debug du scénario)
```bash
# Simule seulement 20 VUs sur 1 min
k6 run --vus 20 --duration 1m -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
```

## Interprétation des métriques

Après le run, k6 affiche un résumé. Les métriques clés à surveiller :

| Métrique                  | Signification                                       | Seuil cible |
| ------------------------- | --------------------------------------------------- | ----------- |
| `http_req_duration p(95)` | 95% des requêtes plus rapides que cette valeur      | < 800 ms    |
| `http_req_duration p(99)` | 99% des requêtes plus rapides que cette valeur      | < 2000 ms   |
| `http_req_failed`         | Taux d'erreurs HTTP (status ≥ 400)                  | < 1%        |
| `apelav_submit_success`   | Taux de quiz allant jusqu'à `submit` sans erreur    | > 95%       |
| `apelav_quiz_duration_ms` | Durée totale d'un parcours simulé (register→submit) | trend       |
| `iterations`              | Nombre de parcours complets effectués               | informatif  |
| `vus_max`                 | Pic d'utilisateurs virtuels                         | 500         |

Si un `threshold` est dépassé, k6 sort avec un code non nul — pratique pour intégrer en CI.

## Dimensionnement EC2 recommandé

Le facteur limitant principal est **bcrypt à l'inscription** (`BCRYPT_COST=12` ≈ 250 ms de CPU par hash). Voilà comment dimensionner :

| Instance       | vCPU | RAM | Verdict pour 500 users |
| -------------- | ---- | --- | ---------------------- |
| `t3.small`     | 2    | 2 G | ❌ insuffisant, MySQL souffre |
| `t3.medium`    | 2    | 4 G | ⚠️  ça passe mais limite, attention burst CPU |
| `t3.large`     | 2    | 8 G | ✅ minimum recommandé |
| `t3.xlarge`    | 4    | 16 G | ✅ confortable |
| `m6i.large`    | 2    | 8 G | ✅ meilleur ratio CPU/€ |
| `m6i.xlarge`   | 4    | 16 G | 🚀 pour de la marge |

**Conseils pratiques :**

- Pour les `t3.*`, surveillez les **crédits CPU** : sous burst soutenu de 500 users vous risquez le dégorgement. Optez pour `t3.unlimited` si vous restez sur cette famille.
- L'inscription concentre la charge CPU bcrypt → si l'événement démarre à 11h et que 300 personnes s'inscrivent en 2 minutes, c'est ~75 hashes/sec à servir. Une `t3.large` tient ~8 hashes/sec/vCPU avec cost=12 → laissez les inscriptions s'étaler ou réduisez `BCRYPT_COST` à 11 (sans descendre plus bas pour la sécu).
- MySQL : un pool de 40 connexions backend + `max_connections=300` côté MySQL est largement dimensionné pour 500 users (chaque participant fait ~5-10 requêtes/min pendant le quiz).
- Redis : ~128 MB suffisent, le tracking de présence et le rate-limit sont en O(N).

## Goulots d'étranglement identifiés

D'après l'architecture :

1. **bcrypt (CPU)** lors du `register` et du `login`. Mitigé par : étalement temporel naturel des arrivées, ou réduction de cost si nécessaire.
2. **Lock MySQL sur `quiz_attempts`** à `start_or_resume` (transaction + `FOR UPDATE`). Très court (~5 ms) — pas un souci à 500 concurrents.
3. **bande passante TLS** sortante : un round du quiz (~50 KB) × 500 users × ~10 round-trips ≈ 250 MB sur 10 min. Une EC2 small/medium suffit.

## Lancer un test prudent en premier

⚠️ **Ne lancez pas directement 500 VUs depuis votre laptop** : k6 sature votre poste et fausse les mesures.

Pipeline recommandé :
1. `--vus 20 --duration 1m` → valider que le scénario marche
2. `--vus 100 --duration 2m` → vérifier les seuils
3. Le scénario complet (500 VUs, 6 min 30) → ne jamais lancer la 1re fois sans backup BDD propre

## Reset entre deux runs

Le test crée des utilisateurs `TestXXX/UserXXX`. Pour repartir propre :

```bash
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" apelav_quizz -e "
  DELETE FROM users WHERE nom LIKE 'Test%' AND prenom LIKE 'User%';
"
```

(les `attempt_answers` et `quiz_attempts` partent en cascade via les FK).
