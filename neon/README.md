# NeonDB — Arsenal Agentique 2026

Le projet est **100 % stateless** : tout l'état vit sur NeonDB (Postgres serverless).
Le disque local n'est plus une source de vérité → plusieurs instances du serveur
peuvent servir le même trafic derrière un load balancer.

## Connexion

Variables dans `.env` (git-ignoré, voir `.env.example`) :

| Variable | Usage |
|---|---|
| `DATABASE_URL` | Connexion directe — réservée aux migrations / psql |
| `DATABASE_URL_POOLED` | Connexion poolée — utilisée par l'application Express |

## Migrations versionnées

Les migrations SQL vivent dans `neon/migrations/` (tri lexicographique, une
transaction atomique par fichier, journalisées dans `public.schema_migrations`).

| Fichier | Contenu |
|---|---|
| `001_init.sql` | Tables fondatrices : `participants`, `formations` (JSONB), `audit_logs`, enums, index anti-doublons |
| `002_durable_state.sql` | Paiement restreint à **Orange Money** (enum `payment_provider_enum`), fichiers durables (`stored_files` BYTEA), sessions admin persistées (`admin_sessions`) |

Commandes :

```powershell
npm run db:migrate   # applique les migrations en attente (connexion directe)
npm run db:check     # diagnostic de santé (connexion, tables, migrations)
```

Les migrations sont **aussi appliquées automatiquement au démarrage du serveur**
(`initNeon()`), donc un déploiement neuf s'auto-provisionne.

## Schéma de données

- `participants` — inscriptions (statuts `PENDING / CONFIRMED / REJECTED / REVOKED`),
  doublons bloqués par index partiels uniques par formation.
- `formations` — registre des formations (config complète en JSONB), exactement une active.
- `audit_logs` — journal immuable (append-only).
- `stored_files` — preuves de paiement Orange Money (`proofs/<formation>/<id>.jpg`)
  et images de formation (`uploads/img-*.jpg`) stockées en `BYTEA`.
- `admin_sessions` — sessions Bearer (SHA-256 du token, TTL 12 h, purge opportuniste).
- `schema_migrations` — journal des migrations appliquées.

## Sécurité

- Tickets billetterie : AES-256-GCM (clé dérivée de `ARSENARL_SECRET_PLACEHOLDER` — voir `server.ts`).
- Preuves Orange Money : lecture uniquement via URL signée HMAC, validité 5 minutes.
- Sessions admin : seuls les **hash SHA-256** des tokens sont stockés en base.
- Secrets uniquement dans `.env` (git-ignoré) — ne jamais les committer.

## Déploiement multi-instance

1. `npm run build` (frontend → `dist/`)
2. Lancer autant d'instances que nécessaire avec le même `.env`
   (`PORT=3001`, `PORT=3002`, ...) derrière un équilibreur (nginx, Fly, Render…).
3. Aucune synchronisation : l'état est partagé via Neon ; la concurrence des
   inscriptions est garantie transactionnellement (`SELECT ... FOR UPDATE`).
