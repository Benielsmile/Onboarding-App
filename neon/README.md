# 🗄️ Infrastructure NeonDB — Arsenal Agentique 2026

Ce dossier contient **toute l'infrastructure de persistance** du projet :
Postgres serverless NeonDB, migrations versionnées, scripts d'exploitation.
L'application elle-même est **100 % stateless** : autrement dit, le disque local
ne stocke plus rien d'important — plusieurs instances peuvent servir le même
trafic derrière un load balancer ou sur Vercel.

---

## 📐 Architecture

```
┌─────────────────────────┐        ┌──────────────────────────┐
│  server.ts (dév local)  │        │  api/index.ts (Vercel)   │
│  Vite HMR + heartbeat   │        │  fn serverless par /api/*│
└───────────┬─────────────┘        └───────────┬──────────────┘
            │          createPigaApp()         │
            └───────────────┬──────────────────┘
                            ▼
             src/server/app.ts (factory Express)
                            │
                            ▼
         src/server/neonStore.ts (pool + accès SQL)
                            │
                            ▼
              NeonDB — Postgres serverless
```

- **`server.ts`** — lanceur du process de longue durée local (HMR Vite, crash
  sentinels, heartbeat mémoire toutes les 5 min, arrêt gracieux).
- **`api/index.ts`** — entrée serverless : monte la même factory sans `listen`.
- **`src/server/app.ts`** — factory Express partagée (routes, middlewares).
- **`src/server/neonStore.ts`** — pool `pg` + couche d'accès SQL (via l'endpoint
  **poolé** Neon), migrations auto au boot, AES-256-GCM, sessions admin.
- **`neon/migrations/*.sql`** — migrations SQL versionnées, appliquées dans
  l'ordre lexicographique, journalisées dans `public.schema_migrations`.

> 💡 Sur Vercel, chaque lambda garde son pool à **1 connexion** (`max:
> VERCEL ? 1 : 10` dans `neonStore.ts`) ; le cold start applique les migrations
> idempotentes une fois, les instances chaudes ne ré-exécutent rien.

---

## 🔐 Connexion (variables d'environnement)

Configurer dans un fichier `.env` **à la racine** (git-ignoré — modèle dans
`../.env.example`) ou dans les Environment Variables Vercel :

| Variable | Usage | Driver |
|---|---|---|
| `DATABASE_URL` | Connexion **directe** : migrations, psql, diagnostics | `db:migrate`, `psql` |
| `DATABASE_URL_POOLED` | Connexion **poolée** (endpoint `-pooler`) : l'application | `pg`, express |
| `ARSENAL_SECRET` | Clé maîtresse AES-256-GCM (tickets) + HMAC (URLs signées) | — |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Console administrateur (override) | — |
| `PORT` | Port du serveur local (défaut 3000) | — |

⚠️ **Règles d'or** : ne jamais committer le `.env` ; utiliser **la même valeur
d'`ARSENAL_SECRET`** en local et en prod (sinon les tickets émis deviennent
invérifiables) ; régénérer le mot de passe Neon s'il a été exposé.

---

## 🗃️ Schéma de données

| Table | Rôle |
|---|---|
| `participants` | Inscriptions — statuts `PENDING / CONFIRMED / REJECTED / REVOKED`, doublons bloqués par index partiels uniques par formation, téléphone strict DRC +243, paiement **Orange Money uniquement** |
| `formations` | Registre des formations (config complète `ProgramConfig` en JSONB) — **exactement une active** (`uq_formations_single_active`) |
| `audit_logs` | Journal immuable append-only (aucune suppression applicative) |
| `stored_files` | Fichiers durables en `BYTEA` : preuves Orange Money (`proofs/<formation>/<id>.jpg`) + images de formation (`uploads/img-*.jpg`) |
| `admin_sessions` | Sessions Bearer admin — **hash SHA-256 uniquement**, TTL 12 h, purge opportuniste |
| `schema_migrations` | Journal des migrations appliquées|

Les compteurs d'inventaire (places confirmées / en attente / disponibles) sont
**dérivés** par agrégation — pas de table de compteur à corriger. La concurrence
est garantie par `SELECT ... FOR UPDATE` sur la ligne de la formation active
(l'ancien mutex applicatif a disparu).

---

## 🚀 Commandes d'exploitation

```powershell
npm run dev          # démarrer le serveur de développement
npm run db:migrate   # appliquer les migrations en attente (connexion directe)
npm run db:check     # diagnostic : connexion, tables, formations, migrations
npm run db:tickets   # vérifier que les billets déchiffrent avec ARSENAL_SECRET
```

Autres scripts manuels (`npx tsx scripts/<fichier>`) :

| Script | Usage |
|---|---|
| `health-check.ps1` | Polling du port local + ping `/api/stats` |
| `cleanup-test-data.ts` | Purge one-shot des participants / fichiers / logs de test |

---

## 🧬 Ajouter une migration

1. Créer `neon/migrations/NNN_ma_migration.sql` (NNN = numéro croissant,
   nom en snake_case) — **`CREATE TABLE/INDEX IF NOT EXISTS`** et blocs
   `DO $$ ... EXCEPTION duplicate_object` pour rester idempotent et re-jouable.
2. `npm run db:migrate` (ou simplement redémarrer le serveur — le boot applique
   les migrations en attente).
3. Vérifier avec `npm run db:check` que le journal liste la nouvelle migration.

Ne **jamais modifier** un fichier de migration déjà appliqué en production :
écrire une nouvelle migration qui inverse/modifie le schéma.

---

## 🚢 Déploiement

### Multi-instance (Render, Fly, VPS, Docker…)

1. `npm run build` → `dist/` servi par l'application.
2. Le même `.env` sur chaque instance ; changer `PORT` si besoin.
3. Aucune synchronisation nécessaire : l'état est partagé via Neon.

### Vercel

1. `vercel.json` est déjà configuré : `/api/*` → `api/index.ts`, le reste → SPA.
2. Environment Variables : `DATABASE_URL_POOLED`, `ARSENAL_SECRET`,
   `ADMIN_EMAIL`, `ADMIN_PASSWORD` (mêmes valeurs qu'en local).
3. Build automatique (`npm run build`, output `dist/`).

### Durabilité

- Cold start : migrations idempotentes ~2-4 s puis trafic.
- Pool : 1 connexion par lambda (endpoint poolé Neon obligatoire).
- Fichiers & sessions : en base, donc survivent aux cold starts et scale-to-zero.

---

## 🔒 Sécurité en résumé

- Billetterie : AES-256-GCM, clé dérivée de `ARSENAL_SECRET`
  (`scripts/check-tickets.ts` vérifie la compatibilité à tout moment).
- Preuves Orange Money : lecture uniquement via **URL signée HMAC 5 min**.
- Sessions admin : hash SHA-256 en base, jamais le token en clair.
- Anti-doublon : contraintes uniques partielles en base + contrôle dans la
  transaction atomique d'inscription.
- Aucun secret dans le code (tout passe par `.env` / Environment Variables).
