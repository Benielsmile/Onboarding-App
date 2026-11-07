# PIGA STUDIO — Arsenal Agentique 2026

Application full-stack d'**onboarding & billetterie cryptographique** pour les
Masterclass PIGA STUDIO : page de vente dynamique, inscription à l'Orange Money,
vérification manuelle des paiements par la Direction, billets signés AES-256-GCM,
et portail admin complet (multi-formations, stats de ventes, journal d'audit).

> 🇨🇩 Conçu pour la RDC : validation stricte des numéros `+243`, paiement
> **exclusivement Orange Money**, interface bilingue FR-friendly.

---

## ⚙️ Stack technique

| Couche | Technologie |
|---|---|
| Front | React 19 + Vite 8 + Tailwind CSS 4 + Lucide + Motion |
| Back | Node.js + Express (`server.ts` / `src/server/app.ts`) |
| Base de données | **NeonDB** (Postgres serverless) via `pg` |
| Chiffrement | AES-256-GCM (billets), HMAC SHA-256 (URLs signées) |
| PWA | Manifest + Service Worker + notifications |
| Déploiement | Local (tsx + Vite HMR) ou **Vercel serverless** (`api/index.ts`) |

---

## 🚀 Démarrage rapide

```powershell
# 1. Dépendances
npm install

# 2. Configuration (copier le modèle et remplir les valeurs)
copy .env.example .env      # DATABASE_URL_POOLED, ARSENAL_SECRET, ADMIN_*

# 3. Vérifier la connexion Neon + appliquer les migrations
npm run db:check
npm run db:migrate

# 4. Lancer (frontend + API + NeonDB)
npm run dev                 # → http://localhost:3000
```

Le premier démarrage : applique les migrations idempotentes, importe le registre
de formations hérité (`data/formations.json`) et insère des données de
démonstration si la base est vierge.

---

## 📁 Structure du projet

```
├── server.ts                  # Lanceur local (HMR Vite, heartbeats, shutdown gracieux)
├── api/index.ts               # Entrée serverless Vercel (monte la même factory)
├── src/
│   ├── server/
│   │   ├── app.ts             # Factory Express partagée (routes API)
│   │   └── neonStore.ts       # Pool Neon + couche SQL + migrations auto
│   ├── admin/                 # Portail Direction (vérifications, formations, stats)
│   ├── client/                # Landing publique (hero, curriculum, onboarding)
│   ├── components/            # Logo, loaders, thème
│   ├── services/api.ts        # Client HTTP typé
│   ├── types/index.ts         # Contrats partagés front/back
│   ├── utils/                 # Téléphone DRC, presets, PDF, WhatsApp, crypto
│   └── assets/                # Images + logo officiel (icon/)
├── neon/                      # INFRASTRUCTURE (voir neon/README.md)
│   ├── migrations/*.sql       # Migrations versionnées
│   └── README.md              # Doc détaillée BDD/déploiement
├── scripts/                   # Exploitation : check, migrate, tickets, icônes
├── public/                    # PWA : manifest, service worker, icônes PIGA
└── supabase/                  # Historicité du schéma d'origine
```

---

## 🧩 Fonctionnalités principales

### Côté public
- Landing dynamique pilotée par la formation **active** (hero, programme, NDA)
- Inscription atomique : anti-doublon (email + WhatsApp), capacité verrouillée
  transactionnellement (`SELECT ... FOR UPDATE`), upload de la preuve Orange Money
- Billetterie chiffrée : ticket AES-256-GCM vérifiable en ligne (`/api/verify/:token`)

### Côté Direction (portail admin protégé)
- Double d'identité owner-only (`.env` : `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
  + sessions Bearer persistées (hash SHA-256, TTL 12 h)
- File de vérification : confirmer / rejeter / révoquer un paiement Orange Money
- Gestion multi-formations : créer, dupliquer, activer, éditer (presets inclus)
- Analytics : ventes par formation, revenus confirmés / pipeline, opérateurs, 14 jours
- Journal d'audit immuable de chaque action

---

## 🔑 Variables d'environnement (`.env`)

| Variable | Rôle |
|---|---|
| `DATABASE_URL_POOLED` | Connexion poolée Neon — utilisée par l'app |
| `DATABASE_URL` | Connexion directe Neon — migrations/diagnostics |
| `ARSENAL_SECRET` | Clé AES-256-GCM des billets + HMAC des URLs signées |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Identifiants de la console Direction |
| `PORT` | Port du serveur (défaut : 3000) |

⚠️ `.env` est **git-ignoré**. Ne jamais committer les valeurs réelles.
Garder **la même `ARSENAL_SECRET`** entre local et production, sinon les
billets émis deviennent invérifiables (`npm run db:tickets` permet de
diagnostiquer).

---

## 🗄️ Base de données

Persistance **100 % sur NeonDB**, migrations versionnées dans `neon/migrations/`
(journalisées dans `schema_migrations`, appliquées au boot et/ou via
`npm run db:migrate`). Tout l'état — y compris les preuves de paiement et les
sessions admin — **vit en base** : le déploiement est stateless et
multi-instance-ready.

➡️ Documentation infrastructure complète : **[`neon/README.md`](./neon/README.md)**

---

## 🧪 Commandes

| Commande | Description |
|---|---|
| `npm run dev` | Développement (tsx + Vite HMR) |
| `npm run build` | Build production (`vite build` → `dist/`) |
| `npm run start` | Production locale (`tsx server.ts`) |
| `npm run lint` | Type-check TypeScript strict (`tsc --noEmit`) |
| `npm run db:check` | Diagnostic Neon (connexion, tables, migrations) |
| `npm run db:migrate` | Appliquer les migrations en attente |
| `npm run db:tickets` | Vérifier la validité cryptographique des billets |
| `node scripts/generate-icons.js` | Régénérer le set d'icônes depuis le logo officiel |

---

## 🚢 Déploiement

- **Vercel** : `vercel.json` prêt (`/api/*` → `api/index.ts`, SPA sur Vite, dist).
  Ajouter les variables d'environnement (même valeurs que le `.env`).
- **Autre hébergeur (Render, Fly, VPS)** : `npm run build` puis
  `npm run start` — aucune synchronisation nécessaire entre les instances.
- Cold start : migrations idempotentes (~2-4 s) puis trafic.

---

## 🔒 Sécurité intégrée

- Prix et fournisseur de paiement décidés **côté serveur uniquement**
- Anti-doublon par index partiels uniques + contrôle dans la transaction
- Sessions admin : hash SHA-256 en base, jamais le token en clair
- Preuves de paiement accessibles uniquement via **URL signée HMAC 5 min**
- Journal d'audit immuable (append-only)
- Secret strictement dans `.env` / Environment Variables (jamais dans le code)

---

## 📞 Contact & Support

**PIGA STUDIO** — The AI Venture Studio & Tech Media
💬 WhatsApp Direction : +243 997 406 281 (https://wa.me/243997406281) — **canal officiel de toute manipulation WhatsApp**
☎️ Orange Money : +243 803 240 289 — **strictement réservé à l'encaissement des paiements (non négociable)**
📧 Direction : voir `.env` (`ADMIN_EMAIL`)
