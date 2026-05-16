# Quiz APELAV 2026

Application web de quiz avec inscription, conçue pour le concours organisé par l'**Association des Parents d'élèves du Lycée Averroès** lors de la Journée Shopping du 23 mai 2026.

Architecture pensée pour **500 participants simultanés**, déployable sur une VM EC2 Amazon Linux 2023.

---

## Sommaire

1. [Fonctionnalités](#fonctionnalités)
2. [Stack technique](#stack-technique)
3. [Test local pas-à-pas](#test-local-pas-à-pas)
4. [Comptes par défaut](#comptes-par-défaut)
5. [Architecture](#architecture)
6. [Sécurité](#sécurité)
7. [Déploiement EC2](#déploiement-ec2)
8. [Test de performance](#test-de-performance)
9. [Maintenance](#maintenance)
10. [Troubleshooting](#troubleshooting)
11. [Structure des fichiers](#structure-des-fichiers)

---

## Fonctionnalités

**Côté participant :**
- Inscription (nom, prénom, mot de passe) → redirection automatique vers le login avec `nom&prenom` pré-rempli
- Connexion sécurisée par JWT en cookie httpOnly
- Quiz de **17 questions** chronométré sur **10 minutes**
- Auto-sauvegarde des réponses (résiste au refresh)
- **Une seule tentative** par personne (unicité nom+prénom)
- Auto-exit + enregistrement automatique du score à expiration du timer
- Score ramené sur **20**
- Interface 100% **responsive mobile**, thème inspiré du flyer (rose poudré, beige, typo script)

**Côté admin :**
- Tableau de bord en temps réel (inscrits, en ligne, en cours, terminés)
- **Contrôle d'activation du quiz** : les participants ne peuvent démarrer leur tentative qu'à partir du moment où l'admin appuie sur « Démarrer le quiz ». Tant que ce n'est pas fait, ils voient une page d'attente qui se rafraîchit toutes les 3 secondes.
- Possibilité de **clôturer** le quiz à tout moment (bloque les nouvelles tentatives ; les tentatives en cours continuent jusqu'à leur terme normal)
- Classement trié par bonnes réponses DESC puis temps ASC
- Liste de tous les participants avec leur statut
- CRUD complet sur les questions et réponses (ajout, modification, suppression)
- **Affichage podium plein écran** (`/admin/podium`) avec révélation progressive 3ème → 2ème → 1er à chaque clic (idéal pour projection sur grand écran le jour J)
- Détail des réponses de chaque participant accessible depuis le classement et la liste des participants (utile pour les contestations)

**Côté participant à la fin du quiz :**
Le participant ne voit **pas** son score ; il reçoit une **phrase de remerciement religieuse** (« جَزَاكُمُ اللَّهُ خَيْرًا · Jazākum Allāhu khayran »). Les résultats sont annoncés en présentiel via l'écran podium contrôlé par l'organisateur.

---

## Stack technique

| Couche             | Technologie                          | Pourquoi                                              |
| ------------------ | ------------------------------------ | ----------------------------------------------------- |
| Frontend           | React 18 + Vite + TailwindCSS        | Bundle rapide, DX moderne, responsive simple          |
| Backend            | Node.js 20 + Fastify 4               | ~3x plus rapide qu'Express, validation JSON Schema    |
| Base de données    | MySQL 8                              | Demandé explicitement, robuste, transactions InnoDB   |
| Cache / présence   | Redis 7                              | Suivi des utilisateurs en ligne, rate-limit partagé   |
| Reverse proxy      | Nginx 1.27                           | TLS, rate-limit IP, headers de sécurité, compression  |
| Auth               | JWT (cookie httpOnly) + bcrypt cost 12 | Standard, sécurisé contre XSS                       |
| Tests de charge    | k6                                   | Scénarios réalistes en JavaScript                     |
| Conteneurisation   | Docker + Docker Compose              | Déploiement reproductible local → EC2                 |

---

## Test local pas-à-pas

> Procédure complète testée sur MacBook M3 (ARM64). Les images sont multi-arch, aucune config spécifique nécessaire.

### Étape 0 — Prérequis (une seule fois)

```bash
# Vérifier l'installation
docker --version          # Docker ≥ 24
docker compose version    # Compose v2

# Si pas installé sur macOS :
brew install --cask docker
# Puis lancer Docker Desktop depuis Applications et attendre qu'il soit "Running"
```

### Étape 1 — Extraire l'archive

```bash
cd ~/Downloads             # ou autre emplacement
tar -xzf apelav-quizz.tar.gz
cd apelav-quizz
```

### Étape 2 — Configurer le `.env`

```bash
cp .env.example .env
```

Génère un vrai `JWT_SECRET` aléatoire :

```bash
echo "JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')"
```

Copie la ligne affichée et remplace celle du fichier `.env` :

```bash
nano .env     # ou: code .env / vim .env
```

**Minimum à modifier** : la valeur de `JWT_SECRET` (sinon `docker compose` refuse de démarrer). Le reste a des valeurs par défaut qui fonctionnent en local.

### Étape 3 — Générer le certificat TLS local

```bash
chmod +x scripts/*.sh          # au cas où l'exec bit aurait sauté
bash scripts/gen-cert.sh
```

Sortie attendue : `[OK] Certificat self-signed généré dans .../nginx/certs`

### Étape 4 — Construire et lancer

```bash
docker compose up --build -d
```

⏱️ **Le premier build prend 3 à 5 minutes** :
- Téléchargement des images Node, MySQL, Redis, Nginx
- `npm install` côté backend
- Build Vite côté frontend

Soyez patient. Les builds suivants seront beaucoup plus rapides grâce au cache Docker.

### Étape 5 — Vérifier que tout est UP

```bash
docker compose ps
```

Vous devez voir 5 conteneurs :

| Conteneur               | Statut attendu       |
| ----------------------- | -------------------- |
| `apelav-mysql`          | `Up` `(healthy)`     |
| `apelav-redis`          | `Up` `(healthy)`     |
| `apelav-backend`        | `Up` `(healthy)`     |
| `apelav-nginx`          | `Up` `(healthy)`     |
| `apelav-frontend-copy`  | `Exited (0)` ✅ normal — il s'arrête après avoir copié les assets statiques dans le volume partagé |

> Le premier démarrage de MySQL prend 20-30s pour initialiser la BDD et exécuter les seeds. Le backend attend que MySQL soit healthy, puis lance `seed-admin.js` (création du compte admin), puis `server.js`.

Test rapide que l'API répond :

```bash
curl -k https://localhost/api/health
# Attendu : {"ok":true,"db":true,"env":"production","ts":...}
```

### Étape 6 — Ouvrir l'application

Ouvrez <https://localhost> dans votre navigateur.

⚠️ **Le navigateur affichera un avertissement TLS** car le certificat est self-signed. C'est NORMAL en local :

- **Chrome / Edge** : « Avancé » → « Continuer vers localhost (non sécurisé) »
- **Safari** : « Afficher les détails » → « visiter ce site web »
- **Firefox** : « Avancé » → « Accepter le risque et poursuivre »

### Étape 7 — Tester le parcours complet

**Côté participant :**

1. Cliquez sur « Je m'inscris » → saisissez Nom / Prénom / Mot de passe
2. Vous êtes redirigé sur `/login` avec le champ identifiant **pré-rempli** sous la forme `nom&prenom`
3. Saisissez votre mot de passe → vous arrivez sur la page d'accueil du quiz
4. Cliquez « Démarrer le quiz » → vous avez **10 minutes** chronométrées
5. Répondez aux questions, naviguez avec Précédent/Suivant ou les numéros en bas
6. Cliquez « Terminer le quiz » → votre score s'affiche, déconnexion automatique après 8s

**Côté admin :**

1. Déconnectez-vous (si connecté en tant que participant)
2. Connectez-vous avec :
   - Identifiant : `admin&admin`
   - Mot de passe : `Apelav2026!ChangeMeASAP` (valeur par défaut de `ADMIN_PASSWORD`)
3. Vous arrivez sur `/admin` avec 4 onglets : **Vue d'ensemble** · **Classement** · **Participants** · **Questions**
4. **Onglet Vue d'ensemble** : cliquez sur **« ▶ Démarrer le quiz »** pour activer le concours. Tant que ce bouton n'est pas pressé, les participants voient une page d'attente. Vous pouvez ensuite :
   - **Clôturer** le quiz (bloque les nouvelles tentatives, laisse les en-cours se terminer)
   - **Mettre en attente** (remet en mode bloqué pour les participants n'ayant pas encore démarré)
5. Onglet Questions : testez la création / modification / suppression d'une question

### Procédure recommandée le jour J
1. Avant l'événement : laissez le quiz en `disabled` (par défaut au premier boot). Les participants peuvent s'inscrire, ils verront la page d'attente.
2. Au moment du lancement (ex. 14h00 pile) : cliquez « ▶ Démarrer le quiz » depuis l'admin.
3. Tous les participants connectés basculent automatiquement sur la page d'intro dans les 3 secondes qui suivent.
4. Une fois le créneau de participation passé : « ■ Clôturer ». Le classement reste consultable, mais aucune nouvelle tentative ne peut démarrer.

### Étape 8 — Suivre les logs (terminal séparé)

```bash
docker compose logs -f backend     # logs Fastify (le plus utile)
docker compose logs -f nginx       # accès HTTP / TLS
docker compose logs -f             # tout en même temps
```

### Étape 9 — Arrêter ou relancer

```bash
docker compose stop                # arrêt (conserve les données)
docker compose start               # redémarrage à chaud
docker compose restart backend     # redémarre uniquement le backend

docker compose down                # arrêt + suppression des conteneurs (volume MySQL conservé)
docker compose down -v             # ⚠️ arrêt + suppression TOTALE (perd inscriptions et scores)
```

---

## Comptes par défaut

### Admin
- **Identifiant :** `admin&admin`
- **Mot de passe :** valeur de `ADMIN_PASSWORD` dans votre `.env` (par défaut `Apelav2026!ChangeMeASAP`)

⚠️ **Changez ce mot de passe avant la mise en production.** Le mot de passe est haché bcrypt au boot via `seed-admin.js` (idempotent : tourne à chaque démarrage du backend et met à jour le hash si la variable d'env change).

### Participants
Ils s'inscrivent eux-mêmes sur `/register`. Le username est construit automatiquement : `nom&prenom` (en minuscules, sans accents).

---

## Architecture

```
                    ┌─────────────┐
                    │   Browser   │
                    └──────┬──────┘
                           │ HTTPS
                  ┌────────▼────────┐
                  │  Nginx (443)    │  TLS, rate-limit, CSP, gzip
                  │  - /api/* → API │
                  │  - /*    → SPA  │
                  └────┬────────┬───┘
                       │        │
        ┌──────────────┘        └──────────┐
        │                                  │
┌───────▼────────┐                ┌────────▼────────┐
│  Fastify API   │                │  SPA React      │
│  (Node 20)     │                │  (statique)     │
└───┬──────┬─────┘                └─────────────────┘
    │      │
    │      └──────────┐
    │                 │
┌───▼──────┐    ┌─────▼────┐
│ MySQL 8  │    │ Redis 7  │
│ (data)   │    │ (présence│
│          │    │  + ratelimit)
└──────────┘    └──────────┘
```

**Flux du quiz :**
1. `POST /api/auth/register` → crée l'utilisateur, renvoie `suggestedUsername`
2. Front redirige vers `/login?u=nom&prenom`
3. `POST /api/auth/login` → cookie JWT httpOnly
4. **Si le quiz n'est pas activé par l'admin** : le participant voit une page d'attente. Toutes les 3s le front interroge `GET /api/quiz/status`. Dès que l'admin bascule sur `enabled`, l'écran passe automatiquement à la page d'intro.
5. `POST /api/quiz/start` → ouvre une tentative (transaction + `FOR UPDATE` pour unicité). Renvoie **HTTP 423** si l'admin n'a pas encore activé ou a clôturé.
6. `POST /api/quiz/answer` → upsert pour chaque réponse cochée (autosave)
7. Timer côté serveur : si `elapsed >= 10min`, n'importe quel appel finalise en `status=timeout`
8. `POST /api/quiz/submit` → calcule le score définitif

**États du quiz (contrôlés par l'admin) :**
- `disabled` (défaut) : participants bloqués sur la page d'attente
- `enabled` : participants peuvent démarrer leur tentative
- `closed` : nouvelles tentatives bloquées, **mais les tentatives déjà démarrées continuent normalement** jusqu'à submit ou timeout

**Anti-tampering** : à chaque sauvegarde de réponse, le serveur vérifie que `answer_id` appartient bien à `question_id`.

---

## Sécurité

| Mesure                              | Implémentation                                           |
| ----------------------------------- | -------------------------------------------------------- |
| TLS                                 | Nginx, TLS 1.2/1.3, ciphers modernes                     |
| HSTS                                | `max-age=31536000`                                       |
| Headers durcis                      | CSP stricte, X-Frame-Options DENY, nosniff, referrer     |
| Versions masquées                   | `server_tokens off`                                      |
| Auth                                | JWT en cookie **httpOnly + SameSite=lax + Secure**       |
| Mots de passe                       | bcrypt cost 12                                           |
| Rate-limit nginx                    | 10 r/s par IP API, 5 r/s sur login/register, burst       |
| Rate-limit applicatif (Fastify)     | 200 r/min global, 10/min register, 20/min login (Redis)  |
| Validation                          | JSON Schema sur tous les endpoints                       |
| Anti-tampering quiz                 | Vérif appartenance answer↔question, timeout serveur      |
| Unicité de tentative                | Contrainte SQL `UNIQUE(user_id)` sur `quiz_attempts`     |
| Unicité d'inscription               | `UNIQUE(nom_norm, prenom_norm)` (normalisation accents)  |
| Body size limit                     | 256 KB côté backend, 1 MB côté nginx                     |
| User non-root dans le container     | `USER app` dans le Dockerfile backend                    |

---

## Déploiement EC2

### 1. Lancer l'instance

- **AMI :** Amazon Linux 2023
- **Taille :** `t3.large` minimum (cf. [`perf/README.md`](perf/README.md) pour le dimensionnement)
- **Security Group :**
  - 443/tcp → 0.0.0.0/0 (HTTPS public)
  - 80/tcp → 0.0.0.0/0 (redirection HTTP → HTTPS)
  - 22/tcp → votre IP uniquement (SSH)
- **Volume EBS :** 20 GB minimum (gp3)

### 2. Bootstrap

Connectez-vous en SSH puis :

```bash
# Récupérez le projet (via scp, git, etc.)
scp -r apelav-quizz/ ec2-user@<EC2_IP>:~

# Sur la VM :
cd apelav-quizz
sudo bash scripts/install-ec2.sh

# Reconnexion pour appliquer le groupe docker
exit && ssh ec2-user@<EC2_IP>
cd apelav-quizz
```

### 3. Configurer puis lancer

```bash
cp .env.example .env
nano .env   # JWT_SECRET (openssl rand -base64 64), mots de passe forts, CORS_ORIGIN=https://votre-domaine.fr
```

**Option A — Cert auto-signé pour test rapide :**
```bash
bash scripts/gen-cert.sh
```

**Option B — Let's Encrypt (production) :**

Si vous avez un nom de domaine pointé sur l'IP de l'EC2 :
```bash
sudo dnf install -y certbot
sudo certbot certonly --standalone -d quiz.votre-domaine.fr
# Copiez les fichiers générés vers nginx/certs/
sudo cp /etc/letsencrypt/live/quiz.votre-domaine.fr/fullchain.pem nginx/certs/server.crt
sudo cp /etc/letsencrypt/live/quiz.votre-domaine.fr/privkey.pem   nginx/certs/server.key
sudo chown ec2-user:ec2-user nginx/certs/*
```

**Option C — ALB + ACM (best practice) :**

Configurez un Application Load Balancer avec certificat ACM, et faites pointer le SG nginx sur l'ALB uniquement. Dans `nginx.conf`, vous pouvez alors retirer la partie TLS et laisser l'ALB gérer la terminaison.

**Lancement :**
```bash
docker compose up --build -d
docker compose logs -f
```

### 4. Sauvegardes automatiques

```bash
# Cron quotidien à 2h du matin
crontab -e
# Ajouter :
# 0 2 * * * cd /home/ec2-user/apelav-quizz && bash scripts/backup-db.sh >> backups/cron.log 2>&1
```

Les backups vont dans `./backups/` (rétention 14 jours, configurable dans le script).

---

## Test de performance

Documentation complète : [`perf/README.md`](perf/README.md).

> ⚠️ **Avant de lancer un test de charge**, activez le quiz depuis l'admin (onglet Vue d'ensemble → « ▶ Démarrer le quiz »). Sinon les VUs reçoivent un HTTP 423 sur `/api/quiz/start` et le test échoue dès le démarrage.

**Quick start :**
```bash
# Installation k6
brew install k6                           # macOS
# OU
sudo dnf install -y https://dl.k6.io/rpm/repo.rpm && sudo dnf install -y k6  # Amazon Linux

# Test léger (5 VUs, 30s) — toujours commencer par ça !
cd perf
k6 run --vus 5 --duration 30s -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js

# Montée progressive
k6 run --vus 20 --duration 1m -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
k6 run --vus 50 --duration 2m -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js

# Test complet 500 VUs (~6 min 30) — JAMAIS depuis votre MacBook directement
k6 run -e BASE_URL=https://localhost --insecure-skip-tls-verify perf-quiz.js
```

⚠️ Le test 500 VUs depuis votre MacBook saturera votre poste (CPU + ports éphémères) et faussera les mesures. Lancez-le depuis une autre EC2 dans la même région que la cible.

**Seuils SLO attendus :**
- `http_req_duration p(95)` < 800 ms
- `http_req_failed` < 1%
- `apelav_submit_success` > 95%

---

## Maintenance

### Rebuild après changement de code
```bash
docker compose up --build -d backend         # rebuild backend seulement
docker compose up --build -d frontend nginx  # rebuild SPA + nginx
```

### Accéder à MySQL en CLI
```bash
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" apelav_quizz
```

### Reset complet (⚠️ perte de données)
```bash
docker compose down -v
docker compose up --build -d
```

### Changer le mot de passe admin
Modifiez `ADMIN_PASSWORD` dans `.env` puis :
```bash
docker compose restart backend
# Le script seed-admin.js s'exécute au boot et met à jour le hash
```

### Voir les logs nginx (access + erreurs)
```bash
docker compose logs nginx
docker compose exec nginx tail -f /var/log/nginx/access.log
```

---

## Troubleshooting

### Erreur `JWT_SECRET requis` au démarrage du backend
Vous n'avez pas créé `.env` ou la variable est vide. Refaites l'étape 2 du test local et générez un secret avec `openssl rand -base64 64`.

### Erreur `bind: address already in use` sur port 443 ou 80
Quelque chose écoute déjà ces ports. Identifiez le processus :
```bash
sudo lsof -i :443
sudo lsof -i :80
```
Sur macOS, les coupables classiques sont Apache, un autre Docker Compose, ou un VPN.

### Le navigateur reste en chargement infini sur https://localhost
- Vider le cache (`Cmd+Shift+R`) ou ouvrir un onglet en **navigation privée** (les anciens cookies d'autres projets sur localhost peuvent perturber)
- Vérifier que nginx tourne : `docker compose ps`
- Vérifier les logs : `docker compose logs nginx --tail=50`

### `apelav-backend` est en `Restarting` en boucle
```bash
docker compose logs backend --tail=80
```
Causes les plus fréquentes :
1. **MySQL pas encore healthy** — attendez 30s, ça repart tout seul (le backend a un `depends_on: condition: service_healthy`)
2. **`JWT_SECRET` absent** — voir plus haut
3. **`.env` mal édité** (caractères spéciaux non échappés dans un mot de passe) — entourer la valeur de guillemets : `DB_PASSWORD="mon!motdepasse@2026"`

### "This site can't be reached" sur https://localhost
Vérifiez l'état des conteneurs :
```bash
docker compose ps
```
Si `apelav-nginx` n'est pas `Up`, regardez ses logs :
```bash
docker compose logs nginx
```
Cause classique : le certificat TLS n'a pas été généré (étape 3 sautée). Lancez `bash scripts/gen-cert.sh`.

### `mysql` reste bloqué au démarrage / `unhealthy`
Si vous êtes sur Mac M3 et que `mysql_data` contient des données d'une ancienne tentative avec une autre architecture :
```bash
docker compose down -v
docker compose up --build -d
```

### `apelav-frontend-copy` apparaît en `Exited (0)`
**C'est normal et voulu.** Ce conteneur a juste pour rôle de copier le build Vite dans le volume partagé `frontend_dist`, puis de s'arrêter. Nginx sert ensuite ces fichiers statiques.

### Une fois inscrit, l'identifiant pré-rempli ne marche pas au login
Le username est `nom&prenom` en **minuscules, sans accents**. Si vous tapez « Dupont » et « Marie », l'identifiant sera `dupont&marie`. La page de login pré-remplit automatiquement le bon format après inscription.

### Le compte admin par défaut ne fonctionne pas
Le mot de passe par défaut est dans `.env` (variable `ADMIN_PASSWORD`). Si vous l'avez modifié, utilisez votre nouvelle valeur. Pour resetter :
```bash
# Édite .env, change ADMIN_PASSWORD
docker compose restart backend
# Le seed-admin.js réécrit le hash au démarrage
```

### Comment vider toutes les inscriptions de test sans perdre la config ?
```bash
docker compose exec mysql mysql -uroot -p"$MYSQL_ROOT_PASSWORD" apelav_quizz -e "
  DELETE FROM users WHERE role='user';
"
# Les attempt_answers et quiz_attempts partent en cascade
# L'admin reste, les questions restent
```

---

## Structure des fichiers

```
apelav-quizz/
├── README.md                       # Ce fichier
├── docker-compose.yml              # Orchestration des 5 services
├── .env.example                    # Modèle de configuration
├── backend/                        # API Fastify
│   ├── Dockerfile
│   ├── package.json
│   └── src/
│       ├── server.js               # Entrée Fastify (plugins, routes)
│       ├── config.js               # Variables d'env centralisées
│       ├── db/
│       │   ├── pool.js             # Pool MySQL + helper transaction
│       │   └── redis.js            # Client Redis + helpers présence
│       ├── services/
│       │   ├── auth.service.js     # Inscription, login, bcrypt
│       │   ├── quiz.service.js     # Logique quiz (start, save, submit, timeout)
│       │   └── admin.service.js    # Classement, stats, CRUD questions
│       ├── routes/
│       │   ├── auth.routes.js
│       │   ├── quiz.routes.js
│       │   └── admin.routes.js
│       └── scripts/
│           └── seed-admin.js       # Idempotent — recrée l'admin au boot
├── frontend/                       # SPA React
│   ├── Dockerfile
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js          # Palette APELAV (rose poudré, beige, bordeaux)
│   ├── index.html
│   ├── public/favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx                 # Routes + composant <Protected>
│       ├── api/
│       │   ├── client.js           # Wrapper fetch
│       │   └── auth.jsx            # AuthProvider + useAuth()
│       ├── components/
│       │   └── Layout.jsx          # Header + footer
│       ├── pages/
│       │   ├── Home.jsx            # Landing avec illustration vectorielle
│       │   ├── Register.jsx        # Form inscription
│       │   ├── Login.jsx           # Form login (pré-rempli via ?u=...)
│       │   ├── Quiz.jsx            # Timer, navigation, autosave, résultat
│       │   └── Admin.jsx           # Tabs : dashboard / ranking / participants / questions
│       └── styles/index.css        # Tailwind + classes utilitaires
├── nginx/
│   ├── Dockerfile
│   ├── nginx.conf                  # TLS, rate-limit, CSP, gzip
│   └── proxy_params.conf
├── mysql/init/
│   ├── 01-schema.sql               # Tables, contraintes, index
│   └── 02-seed.sql                 # 17 questions APELAV + Q17 bonus
├── perf/
│   ├── perf-quiz.js                # Scénario k6 (500 VUs, parcours complet)
│   └── README.md                   # Guide perf
└── scripts/
    ├── gen-cert.sh                 # Cert self-signed local
    ├── install-ec2.sh              # Bootstrap Amazon Linux 2023
    └── backup-db.sh                # Dump MySQL daté avec rotation
```

---

## Crédits

Construit pour l'**Association des Parents d'élèves du Lycée Averroès** (APELAV) — 65 rue de la Prévoyance, 59000 Lille.

Palette inspirée du flyer de la Journée Shopping du 23 mai 2026.
