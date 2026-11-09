---
name: piga-onboarding-app
description: >
  SKILL DE RÉPLICATION 100% — Recréer l'application PIGA STUDIO Onboarding
  (landing premium + billetterie Orange Money + console Direction + scanner
  QR cryptographique) uniquement avec des prompts, sans écrire une ligne de
  code. À utiliser quand l'utilisateur demande de reconstruire, cloner,
  étendre ou déployer PIGA STUDIO Onboarding ou une billetterie/formation
  équivalente. Toute fonctionnalité manquante = échec du skill.
---

# 🏛️ SKILL — PIGA STUDIO ONBOARDING (Réplication 100 %, zéro code)

> **Destinataire :** tout humain — comptable, avocat, vendeur de poulet —
> colle les prompts P1→P12 puis D1→D5 dans Claude/Opencode, dans l'ordre,
> sans rien inventer. **Claude fait 100 % de la technique.**
>
> **Interdits absolus pour l'agent (Claude) :**
> 1. Ne JAMAIS livrer de code placeholder/simplifié/témoin (`// TODO`, "à compléter", maquettes).
> 2. Ne JAMAIS sortir de la stack verrouillée (§2) ni ajouter une dépendance non listée.
> 3. Ne JAMAIS interroger de vraie base de données de production ; toujours la base locale/démo.
> 4. Ne JAMAES embarquer de vrais mots de passe ou secrets dans le code — tout passe par variables d'environnement (§7).
> 5. Chaque prompt P est "terminé" seulement si sa **Critère d'acceptation** est vérifié.
> 6. Rejeter poliment les demandes de raccourcis ("fais juste une démo") : ce skill exige 100 %.

---

## 1. LE PRODUIT (à recréer à l'identique)

**PIGA STUDIO — Onboarding App.** Plateforme de vente de billets pour les
masterclass de formation, avec encaissement manuel vérifié :

```
CLIENT (landing premium)                          DIRECTION (console admin)
كس Inscription en 4 étapes                 →      💳 Valider le paiement Orange Money
  1. Détails (nom, email, tel DRC)                💬 Génération du message WhatsApp
  2. NDA accepté (obligatoire)                    🎫 Émission du billet PDF + QR
  3. Paiement Orange Money + capture écran        🔍 Scanner QR en direct à l'entrée
  4. Récapitulatif + envoi                         📊 Dashboard ventes & audit
     → statut PENDING                             🗑 Nettoyage post-formation
DIRECTION vérifie la preuve → CONFIRMED            registre multi-formations
CLIENT reçoit le PDF (QR signé AES-256-GCM)        par WhatsApp à Direction
```

**Chaîne cryptographique du billet** (aucun raccourci toléré) :
1. Confirmation paiement → payload `{t: codeBillet, n: nom, d: date, s: 'CONFIRMED', iat}` 
2. Chiffrement **AES-256-GCM** (clé = SHA-256 du secret d'env, clé/IV aléatoire) → `IV.CIPHER.TAG` hex
3. Token renvoyé vers PDF : QR code = URL `https://site/#verify?token=<IV.CIPHER.TAG>`
4. Vérification = déchiffrement + contrôle `s === 'CONFIRMED'` + `d` = date de session
5. Tout échec → "tentative d'altération détectée".

---

## 2. STACK TECHNIQUE VERROUILLÉE (aucune substitution)

| Couche | Choix exact |
|---|---|
| Front | React 19 + TypeScript (strict) + Vite 8 + Tailwind CSS **v4** (`@import "tailwindcss"` + `@custom-variant dark`) |
| Polices | Montserrat (titres, `.font-montserrat`), Poppins (sous-titres), Inter (corps, défaut) |
| Serveur | Express 4 (`express.json({limit:'20mb'})`), partagé Vite dev middleware + build statique |
| DB | **Neon Postgres serverless** via `pg` Pool (`DATABASE_URL_POOLED`, max 1 sous Vercel / 10 en local) |
| Serveurless | Vercel singleton `api/index.ts` (module-level `appPromise = createPigaApp()`) |
| Crypto | Node `crypto` natif UNIQUEMENT (AES-256-GCM, HMAC-SHA256, timingSafeEqual, randomBytes) |
| PDF | `jspdf` (paysage A5) + `qrcode` (QR dataURL, ECC `H`) |
| Scanner | **Aucune lib de scan.** Pipeline maison : `getUserMedia` → `<video>` direct → dessin frame sur canvas → détection **`BarcodeDetector` natif Chrome** → secours automatique `jsqr` après ~5 s |
| Images client | lucide-react (icônes), motion (animations), html5-qrcode INTERDIT (abandonné: écrans noirs) |
| PWA | manifest.json + sw.js (cache statique '/, /index.html, /manifest.json' seulement) + Notification API |
| Co-code style | Icône SVG dessinée maison INTERDITE quand l'asset officiel fourni existe — toujours utiliser le fichier de la Direction (`src/assets/icon/PIGA LOGO SYMBOL.png`) |

**Arbre complet des fichiers à produire (~35 fichiers) :**
```
index.html (splash statique PIGA + favicon unique /favicon.png + PWA meta)
vercel.json (headers + rewrites /api → /api/index, SPA → /index.html)
server.ts | api/index.ts
public/: manifest.json, sw.js, logo-symbol.png, favicon.png, apple-touch-icon.png, pwa-192/512/maskable-512, assets/aistudio/PIGA_LOGO_OFFICIEL_1_8d9f27ba.png, PIGA_LOGO_OFFICIEL_2_24ff6bb2.png
neon/migrations/: 001_init.sql, 002_durable_state.sql, 003_wipe_support.sql
src/types/index.ts
src/server/: app.ts (factory Express ✓ partagée), neonStore.ts (référentiel + crypto + migrations)
src/utils/: programPresets.ts, pdfGenerator.ts, dashboardPdfGenerator.ts, whatsappHelper.ts, drcPhoneValidator.ts, programAssets.ts, cryptoSecurity.ts (version client webcrypto), pwaNotifications.ts
src/services/api.ts (couche client typée)
src/context/ThemeContext.tsx (dark/light + variant logo)
src/components/: PigaLogo.tsx (variants full/compact/symbol-only/logo1/logo2), ThemeToggle.tsx, BrandLoader.tsx?
src/client/: ClientHeader.tsx, ClientHero.tsx, ClientCurriculum.tsx, ClientOnboardingModal.tsx, ClientFooter.tsx
src/admin/: AdminPortal.tsx, FormationEditor.tsx
src/assets/icon/PIGA LOGO SYMBOL.png | src/assets/images/ (hero, auditorium, seal)
scripts/: generate-icons.ps1, check-neon.ts, run-neon-migrations.ts, check-tickets.ts
.env.example (placeholders uniquement) | SECURITY-PENTEST-REPORT.md
```

---

## 3. DESIGN SYSTEM (non négociable)

- **Palette :** Rouge PIGA `#E50914` (hover `#C80711`), Noir absolu `#000000` (fond dark), Blanc `#FFFFFF` (fond light), surfaces `#0A0A0A` / `#F8F9FA`, frontières `#1E1E1E` / `#222222` (dark), Gris ardoise Tailwind ailleurs, accents success `#10B981`, warning `amber`.
- **Formes :** pills full-round pour CTA/header client ; `rounded-xl` cartes console admin ; `rounded-lg` pour inputs ; header admin sticky top-0 z-30.
- **Client = ligne premium éditoriale :** héro centré `clamp(30px,8vw,86px)` titres noirs, chips statistiques verre (backdrop-blur), splash statique PIGA pré-paint dans index.html (halo roux + rail), etc.
- **Admin = densité de pilotage :** tableaux, badges de statut (PENDING amber / CONFIRMED vert / REJECTED roux / REVOKED oranges), zéro compromis sur lisibilité (l'utilisateur est déficient visuel : tout témoignage critique ≥ 15px).
- **Mobile-first <$= 360px STRICT :** navbar admin = bandeau repliable (`☰`) + panneau débotounes ; header client = logo **symbol-only** (le PNG officiel — jamais un SVG improvisé) ; CTA "Réserver" sans prix <$ 640px ; taglines `break-words` successifs (JAMAIS `whitespace-nowrap` sur du texte long) ; `index.css` global : `html,body{overflow-x:clip}` + `img,video,svg,canvas{max-width:100%}` + `h1,h2,h3{overflow-wrap:break-word}`.
- **Thème :** classe `dark` sur `<html>`, toggle persisté localStorage (`piga_theme`), conformité Tailwind `@custom-variant dark (&:where(.dark, .dark *))`.

---

## 4. BASE DE DONNÉES NEON (SQL complet des 3 migrations)

**`neon/migrations/001_init.sql`**
```sql
CREATE TABLE IF NOT EXISTS public.participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  email_masked TEXT NOT NULL,
  phone_raw TEXT NOT NULL,
  phone_international TEXT NOT NULL,
  phone_masked TEXT NOT NULL,
  network_carrier TEXT NOT NULL DEFAULT 'Unknown',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','REJECTED','REVOKED')),
  price_usd NUMERIC(10,2) NOT NULL DEFAULT 0,
  program_id TEXT NOT NULL,
  payment_provider TEXT NOT NULL DEFAULT 'ORANGE_MONEY',
  transaction_reference TEXT DEFAULT 'N/A',
  proof_file_name TEXT DEFAULT 'screenshot_orange_money.jpg',
  proof_storage_path TEXT NOT NULL DEFAULT 'proofs/pending_upload.jpg',
  nda_accepted BOOLEAN NOT NULL DEFAULT false,
  nda_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  confirmed_at TIMESTAMPTZ,
  ticket_code TEXT UNIQUE,
  crypto_token TEXT,
  admin_notes TEXT,
  revoked_at TIMESTAMPTZ,
  revocation_reason TEXT
);
CREATE INDEX IF NOT EXISTS idx_participants_program ON public.participants(program_id);
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.participants(status);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  user_agent TEXT,
  ip_address TEXT,
  metadata JSONB DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS idx_audit_ts ON public.audit_logs(timestamp DESC);

CREATE TABLE IF NOT EXISTS public.stored_files (
  path TEXT PRIMARY KEY,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.formations (
  id TEXT PRIMARY KEY,
  config JSONB NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  updated_by TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.admin_sessions (
  token_hash TEXT PRIMARY KEY,
  admin_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT now() + interval '12 hours'
);
```
(Cf § prompts P6 : `002` ajoute index/conf-inventaire + registre ; `003` support wipe. Seule exigence codée ici-ci-haut = structure ; l'agent complète avec prompts.)
Enregistrements d'amorçage : une formation par défaut (ProgramConfig complet §8) + 2 participants seed démo (1 CONFIRMED avec token chiffré réellement émis, 1 PENDING) + 1 ligne d'audit SYSTEM_BOOT.

---

## 5. CONTRAT API (Express, tous montés dans `createPigaApp()`)

| # | Méthode + route | Accès | rôle |
|---|---|---|---|
| 1 | GET `/api/stats`, `/api/inventory` | public | capacité/vendus/pending/prix |
| 1b | GET `/api/program-config` | public | config formation active (kicker, titre, tagline, date, horaires, lieu, description, OM +243 803 240 289, titulaire, email/tel Direction, modules[4+] {id,index,title,iconName,highlight,description}, claires NDA 1-4, vipWhatsAppUrl, images) |
| 1c | GET `/api/program-presets` | public | TRAINING_PRESETS |
| 1d/1e | POST `/api/admin/program-config`, `/api/admin/program-preset` | Bearer | mise à jour config / chargement preset |
| 2 | POST `/api/register` | public | inscription atomique |
| 3 | GET `/api/proof-signed-url?path=…` | **BEOUGH réserver à l'admin (leçon pentest F-03)** | génération URL signée HMAC 5 min |
| 4 | GET `/api/storage/proof?path&expires&sig` | signature | lecture private |
| 5 | GET `/api/verify/:token` | public | déchiffrement token (multi-format côté client) |
| 5b | GET `/api/ticket/:participantId/pdf` | public (id non-guessable) | PDF billet (CONFIRMED only) |
| 6 | POST `/api/admin/auth` | public | login → session 12h (audit DENIED/GRANTED) |
| 7-11 | GET `/api/admin/stats`, `/participants`, `/audit-logs` POST `/confirm-payment`, `/reject-payment`, `/revoke-reservation`, `/log-action`, `/reset-workshop` | Bearer | cœur Direction |
| 12-16 | GET/POST `/api/admin/formations`, POST `/formations/duplicate`, POST `/formations/:id/activate`, DELETE `/formations/:id` (active + dernière protégées) | Bearer | registre formations |
| 17 | POST `/api/admin/upload-image` (dataURL jpeg/png/webp ≤ ~6Mo) + GET `/api/uploads/:file` (regex anti-traversal `^[a-zA-Z0-9._-]+$`) | Bearer / public | médias formation |

**POST /api/register — validation ZÉRO-TRUST atomique (transaction Fort UPDATE) :**
1. Tel DRC : `cleanAndValidateDRCPhone` — nettoie des séparateurs, accepte 081234567/24381234567/+243..., exige préfixe opérateur valid (81/82/84/85/89/91-..., +243 + 9chiffres), retourne `{formattedInternational: '243…', carrier: 'Vodacom (M-Pesa)'|'Orange DRC (Orange Money)'|'Airtel'|'Africell'…}` sinon `DRC_PHONE_INVALID`.
2. Email regex `^[^\s@]+@[^\s@]+\.[^\s@]+$`, NDA obligatoire, provider == ORANGE_MONEY, CAPACITY (SELECT count PENDING+CONFIRMED FOR UPDATE) et anti-duplicate (phone_international OU lower(email)) — erreurs servies catégorisées au client en message humain.
3. Insertion + stockage preuve (dataURL → décodage data-mime) + audit `SYSTEM_GATEWAY/VIEW_PROOF`.
4. Réponse : `{success, participantId: <uuid>, ticketCode: 'AA-2026-<6hex>-<3der du tel>', status:'PENDING', phoneFormatted}`.

**API admin sécurisée :** session `crypto.randomBytes(32).hex` stockée **SHA-256-hash-only** en base, TTL 12h, purge à l'opportuniste ; gateway `requireAdminSession` sur `/api/admin/*` sauf `/auth` ; identité unique env `ADMIN_EMAIL`/`ADMIN_PASSWORD` comparée en constant-time via SHA-256 digest (timingSafeEqual).

---

## 6. LOGIQUE MÉTIER VERROUILLÉE (règles PIGA)

1. **DEUX CANAUX, jamais mélangés :** Orange Money `+243 803 240 289` = encaissement UNIQUEMENT (non négociable). Toute manipulation WhatsApp → Direction `+243 997 406 281` (`https://wa.me/243997406281`, `PIGA_DIRECTION_WHATSAPP_URL`).
2. **Titulaire du compte :** `Beniel Musuela` (personne physique · Chargé d'Administration PIGA STUDIO) — JAMAIS "PIGA STUDIO" sur le compte encaisseur.
3. **Message WhatsApp de confirmation (template V3-QR-PDF, ~980 chars max pour tenir sur tous téléphones) :**
   Bloc meta (code billet, montant, réf OM) → **UN SEUL lien = PDF billet** (contient le QR) → note "le QR Code d'accès est DANS le PDF" → Communauté VIP → `💬 WhatsApp Direction : wa.me/243997406281` → email → tagline.
   Bouton admin : ouverture d'un **APERÇU GROS CARACTÈRES** (lien PDF, message complet, badge `WhatsApp V3-QR-PDF ✅`) puis OUVRIR WhatsApp. Badges visibles = autodiagnostic d'une console périmée.
4. **Message de révocation :** dossier + motif + transfert vers OM `+243 803 240 289` (compte : Beniel Musuela) + canal WhatsApp Direction.
5. **Vérification 3 formats** (console scanner, auto-extraction) : code billet / lien (`#verify?token=` ou `?ticket=`) / jeton brut. Le code billet → résolution participant puis déchiffrement RÉEL du jeton émis (statuts PENDING/REJETED → messages d'affaire, pas "billet forgé" ; seul un token altéré reste "forte altération").
6. **Scanner (pilier, pipeline maison) :** bouton "Activer Caméra Scanner" → getUserMedia (facingMode ideal 'environment', 1280×960) → `<video autoPlay muted playsInline>` plein cadre (pas de lib) → **chaque 130ms** : dessin canvas (≤640px) → `BarcodeDetector.detect({formats:['qr_code']})` natif → si X à ~38 ticks (5s) → **secours jsqr `jsQR(imageData)`** → hit → coller + vérifier + stop. Diagnostics en clair sous la caméra : compteur frames ("Recherche active… N image(s) analysée(s)"), badge "moteur QR natif ✅", badge "moteur de secours jsQR actif", "🎥 Vue caméra en direct ✅", erreurs exactes (OverconstrainedError/permissions/occupée). NOTE utilisateur : un téléphone ne scrolle jamais le QR affiché sur LUI-MÊME.
7. **Bouton « Jeton »** dans la table participants (CONFIRMED) : modale grosses caractères = lien `#verify?token=` (ce que contient le QR) + jeton complet + COPIER LE JETON COMPLET. Pour quand la caméra est indisponible.
8. **PDF billet (paysage A5, NOIR absolu) :** logo + nom + code + date/horaires/lieu + montant + réf OM + QR (ECC H, 320px) + badge "SCAN CONTRÔLE D'ACCÈS PIGA / Signature inviolable AES-256-GCM" + boutons liés WhatsApp VIP / vérifier en ligne + footer direction + canal WhatsApp officiel. Servi UNIQUEMENT si `status === 'CONFIRMED'` sinon 404 message d'affaire.
9. **Dashboard (admin) :** Places Confirmées / En Attente / Révoquées / Recettes ($ USD) + stats 14 jours + opérateurs + par formation + audit logs lisibles + rapport PDF imprint + WIPE (mot "NETTOYER" requis) - l'audit log survit au wipe.
10. **Formation Editor :** champ config complet (titre, tagline, dates, prix, capacité, statut OPEN/SOLD_OUT/COMING_SOON, OM numéro + titulaire, Direction email/tel, modules dynamiques add/edit/remove, clauses NDA dynamiques, vipWhatsAppUrl, images hero/auditorium avec upload base64) + registre : créer/dupliquer/activer/supprimer (protégées) + bande vérification GROSSES LETTRES du compte encaisseur.
11. **Config responsive serveur :** tout est pilotable MAIS les defaults codés = PIGA (voir `programPresets.ts` TRAINING_PRESETS + BLANK_FORMATION_TEMPLATE + DEFAULT_PROGRAM_CONFIG `arsenal-agentique-2026`).

---

## 7. SÉCURITÉ NON NÉGOCIABLE (leçon du pentest F-01→F-10)

- **Secrets 100 % env :** `DATABASE_URL`, `DATABASE_URL_POOLED`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` (20+ chars alétoire requirement), `ARSENAL_SECRET`. `.env.example` = placeholders UNIQUEMENT (jamais de vraie valeur). Secret scan/Push protection GitHub ACTIVES.
- **Rotations :** jamais de fallback `'motdepasse'` dans le code source. Toute ancienne valeur par pente révise/rotationne au cycle des leçons.
- `rejectUnauthorized` réfusé : SSL DB vérifié (Neon CA). Rate-limit sur login (5/min/IP) et register (3/h/IP) via captcha invisible recommandé (Turnstile). Anti-bot : sans CAPTCHA la capacité peut être drainée à blanc par un concurrent.
- CSP/HSTS (helmet ou headers Vercel), catch-all error middleware JSON, JSON body 2mb reasonable.
- Audit log append-only : DENIED/GRANTED login, toutes actions de validation, wipe.
- PII : noms+emails+phones massqués (maskEmail/maskPhone) dans les sorties publiques.

---

## 8. LES 12 PROMPTS DE CONSTRUCTION (à coller UN PAR UN dans Claude)

> Instructions générale à coller AVANT P1 :
> *"Applique le skill PIGA-STUDIO-APP-SKILL.md. Travaille uniquement avec la stack §2, la palette §3, la DB §4, le contrat API §5, la logique métier §6 et la sécurité §7. Aucun TODO, aucune simplification. Termine chaque étape par un `npx tsc --noEmit` et un `npm run build` verts, puis résume ce qui a été généré."*

**P1 — Squelette & config :** crée `package.json` (scripts dev/build/lint + deps exactes §2), `tsconfig` strict, `vite.config.ts` (plugin react + tailwindcss-vite + alias), `index.html` (splash statique PIGA noir complet + favicon unique + PWA meta), `src/index.css` (Tailwind v4, tokens §3, fonts, animate-fade-in, anti-overflow global), `.env.example` placeholders, `.gitignore`, `vercel.json`, netrouillable `metadata.json`.

**P2 — Types & presets métier :** `src/types/index.ts` (Participant, RegistrationRequest/TicketPayload, InventoryStatus, ProgramConfig complet, AuditLogEntry avec enum action, AdminStats, FormationSummary, CryptographicTokenVerification, etc. — cf §5/§6) + `src/utils/programPresets.ts` (DEFAULT arsenal-agentique-2026 : kicker "PIGA STUDIO TECH MEDIA", titre "Arsenal Agentique : L'Intelligence Logicielle de Demain", date "Vendredi 13 Novembre 2026", 09h-18h Kinshasa, prix 20, capacité 80, OM +243 803 240 289 (titulaire Beniel Musuela·Chargé d'Admin), Direction Benielsmile89@gmail.com / 0997406281, 4 modules IA (LangGraph, Tool-calling Zero-Trust, Edge/Postgres RLS, Billetterie AES-256-GCM), 4 clauses NDA, vipWhatsAppUrl, images) + BLANK_FORMATION_TEMPLATE + TRAINING_PRESETS + `whatsappHelper.ts` (constantes des 2 canaux, resolveMessageInfo, generateWhatsAppConfirmationUrl V3-QR-PDF complet, generateWhatsAppRevocationUrl, directionWhatsAppLink).

**P3 — Utilitaires fonctions de vérité :** `drcPhoneValidator.ts` (nettoyage/validation opérateurs RDC + formats sortie), `cryptoSecurity.ts` (WebCrypto client PBKDF2↔AES-GCM version decode), `programAssets.ts` (mapping images legacy+uploads+fallback), `pwaNotifications.ts` (usePWAInstall + notifications push/postMessage), `DashboardPdfGenerator`/`pdfGenerator.ts` (paysage A5 complet §6.8 avec QR `qrcode` ECC H + footer direction + canal WhatsApp).

**P4 — Design system composants :** `ThemeContext` (dark/light + variant logo, localStorage), `ThemeToggle` (mode + variante logo), `PigaLogo` (5 variants — 'symbol-only' = `<img src="/logo-symbol.png">` le PNG officiel, JAMAIS de SVG maison), BrandLoader consistent avec le splash.

**P5 — Client complet :** `ClientHeader` (fixed pill glass logo symbol-only sous md/wordmark ≥md, nav pills, CTA reserve prix caché <$sm, burger menu lg), `ClientHero` (eyebrow wrap, clamp 30-86px, tagline `break-words`, CTAs, chips stats), `ClientCurriculum` (modules + NDA bloc + règlement), `ClientOnboardingModal` (4 étapes : infos → NDA → paiement OM avec capture b64 miniseé canvas ≤1400px/q=0.72 → récap), alertes erreurs DRC_PHONE_INVALID/EMAIL/CAPACITY/DUPLICATE, `ClientFooter` (brand statement + tagline successive `break-words` + contact pills incl. 🔗 WhatsApp Direction + OM chip + colonne nav + contact sujets), App.tsx orchestration (data loads /api/program-config + /api/stats, modals, admin gate).

**P6 — Serveur :** `src/server/neonStore.ts` (Pool§2, 3 migrations SQL §4 exécution idempotente une-time/globalThis, seed démo §4, crypto AES-256-GCM §1, sessions admin hashées 12h, registerParticipantAtomic transactionnel §5, mouvements confirm/reject/revoke avec audit, wipe avec audit protégé savepoint, CRUD formations protégé, getFormationStats 14 jours) + `src/server/app.ts` (createPigaApp / toute la surface §5, gateway admin, sécurité §7, static dist / Vite middleware) + `server.ts` launcher (SIGINT cleanup + heartbeat) + `api/index.ts` serverless singleton.

**P7 — Console Admin — noyau :** `AdminPortal.tsx` login timing-safe → dashboard metrics, participants table (recherche code/nom/email/tel/ref, filtres statut), flux confirm (regénère crypto_token + PDF prêt) / reject / revoke (modale motif + message WhatsApp), Jeton modal (lien QR + copie), audit logs lucibles, wipe "NETTOYER" (danger) + rapport PDF, badges header + ORANGE MONEY + WhatsApp V3-QR-PDF ✅.

**P8 — Console Admin — scanner & mobile :** pipeline maison §6.6 avec tous les diagnostics, 3 formats de vérification + code-billet résolu + messages d'affaire (PENDING ≠ forgé), mobile : navbar repliable admin (`adminNavItems`, dossier ☰ header), gros caractères partout (usage déficient visuel).

**P9 — FormationEditor & registre :** sections config (identité, programme modules CRUD, NDA clauses, contacts) + bande vérification encaisseur GROSSES LETTRES + registre multi-formations (créer/dupliquer/activer/supprimer protégées) + upload images admin (base64 ≤6Mo image/jpeg png webp).

**P10 — Services & types alignés au serveur :** `src/services/api.ts` complet (client typé de toutes les routes, bearer admin, sanitize textes DOMPurify nothing-tags).

**P11 — PWA & assets publics :** `public/manifest.json` (icônes PIGA 192/512 + maskable), `sw.js` (cache statique + push + notificationclick 'open_admin'), favicon.png = copie EXACTE de `src/assets/icon/PIGA LOGO SYMBOL.png`, apple-touch 180 noir, scripts\generate-icons.ps1 (réplique à partir du SYMBOLE officiel — jamais un autre fichier), splash ± dérouté au BrandLoader.

**P12 — Endgame & anti-régression :** passe `tsc`+`build` verts, tests manuels scenario (inscription démo → paiement→ confirm → PDF→ WhatsApp preview→ scan), `npm audit` 0 vulnérabilités HIGH+, checklist §9 rempli point par point, `SECURITY-PENTEST-REPORT.md` section "à vérifier avant chaque mise en prod".

---

## 9. CHECKLIST D'ACCEPTATION 100 % (à remplir avant de dire "fini")

- [ ] Landing : splash PIGA pré-paint, logo symbol-only mobile / wordmark desktop, héro text-balance, modules NDA, footer 2-canaux (pills WhatsApp Direction + OM récepteur)
- [ ] Inscription 4 étapes avec validation tel DRC (formats 081/24381) + NDA obligatoire + capture compressée client
- [ ] PENDING apparaît dans la console + badge push notification
- [ ] Confirm → AES token → PDF CONFIRMED-only avec QR scannable → WhatsApp V3 preview contenant UNIQUEMENT le lien PDF
- [ ] Scanner : compteur frames visible, moteur natif ✅, secours jsQR à 5s, verdict passeport vert/des statuts d'affaire protégés
- [ ] Bouton Jeton copie le token du billet = déchiffrement obligatoire
- [ ] Audit log contient DENIED login / CONFIRM_PAYMENT / WIPE immuable après wipe
- [ ] Two canaux : OM numéro uniquement pour paiement ; tout le WhatsApp → Direction
- [ ] Favicon = PNG officiel ; aucun SVG logo maison dans le repo
- [ ] Responsive : à 320px, 0 scroll horizontal, navbar repliable, tagline successive
- [ ] `npm audit` WHSCunaszero HIGH+ ; secrets uniquement en env ; `.env.example` sans vraie valeur
- [ ] Vercel : app forte sur functions et avec Neon DB démarrée, stats positif

## 10. PROMPTS DÉPLOIEMENT (D1-D5, pour un non-codeur)

**D1:** *"Guide-moi pas-à-pas (cliques exacts) pour créer ma base Neon gratuito et récupère DATABASE_URL + DATABASE_URL_POOLED."*
**D2:** *"Guide-moi (cliques exacts) pour créer le repo GitHub, y pousser le code, et connecter Vercel (Import Project)."*
**D3:** *"Liste-moi les variables d'environnement Vercel à remplir (noms exacts / valeurs / environnements) puis génère mon ADMIN_PASSWORD fort et mon ARSENAL_SECRET long ; montre où les coller."*
**D4:** *"Après le 1er déploiement, diagnostique la page fantôme : vérifie build Vercel, headers sw.js, migration DB au boot, liste les fixes d'une ligne."*
**D5:** *"Planifie la rotation (secrets) + roadmap sécurité du pentest (rate-limit, déverrouillage /api/proof-signed-url, CSP, alerte DENIED x5) en 5 jours ouvrables + post-deploiement."*

## 11. PIÈGES CLASSIQUES (réponses pré-mortem)

1. `html5-qrcode` → écrans noirs/double-instance : remplacer IMMÉDIATEMENT par le pipeline maison (§6.6).
2. `wa.me` text > ~2000 chars → préfill égoretical (message tronqué/abandonné) → template court V3.
3. SVG logo improvisé sur mobile → se FAIT HMAC/VIS : seuls les ASSETS la bons utilisés (`logo-symbol.png`).
4. `whitespace-nowrap` sur textes longs → sortent du 320px → `break-words` partout sur les taglines.
5. Wordmark logo sur 320px → symbole seul sous md + CTA sans prix.
6. Fichiers assets (hero imgés de fallback) : saver repo les update sinon UNRESOLVED_IMPORT au build — importer via programAssets.ts.
7. Secret déplifié c'est accidents en history git → rotation + filter-repo + scanning.
8. Scanner même téléphone → physiquement impossible (tenir ça toujours dit au client, la MÉTHODE 2 clics bouton Jeton → coller).
9. Config non responsive ne rend pas `/src/assets/*` sur prod — importer via bundler (programAssets) ou servir via /api/uploads.
10. Ne JAMAIS skip la checklist §9 : chaque case refusée = repartir au prompt logique prévu.

---
*Skill dérivé du vrai projet `D:\IP PIGA STUDIO\Projects\Onboarding-App` (commit a34be27+, console scan OK). Toute divergence avec le code réplique = le SKILL prime.*

