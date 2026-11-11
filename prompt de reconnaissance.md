CONTEXTE PROJET — PIGA STUDIO Onboarding App (reprends ce contexte, n'explore pas à l'aveugle)

PROJET : D:\IP PIGA STUDIO\Projects\Onboarding-App
Stack : React 19 + TS + Vite 8 + Tailwind v4 (client) / Express 4 + tsx (server.ts, api/index.ts Vercel) / Neon Postgres (pg). Serverless stateless, tout en base.

CE QUI EXISTE DÉJÀ (ne pas refaire) :
1. Billetterie Orange Money : inscription 3 étapes (ClientOnboardingModal.tsx) avec preuve capture, statuts PENDING/CONFIRMED/REJECTED/REVOKED, vérification MANUELLE par la Direction (AdminPortal.tsx, auth owner-only env ADMIN_EMAIL/PASSWORD, gateway Bearer 12h sur /api/admin/*).
2. Billets AES-256-GCM + QR, PDF serveur /api/ticket/:id/pdf (CONFIRMED uniquement), message WhatsApp confirmation avec facture PDF + lien VIP (whatsappHelper.ts).
3. Dashboard Direction : stats ventes, export PDF (dashboardPdfGenerator.ts), wipe post-atelier /api/admin/reset-workshop.
4. AMBASSADEURS (affiliation 15% = $3/vente) : migration 004 appliquée. Codes AMB-XXXX, lien magique ?ref=, tracking clics dédupliqué (ambassador_clicks), colonnes participants (ambassador_code/id, commission_usd snapshot, commission_status PENDING→EARNED(à la confirmation)→PAID(bouton console)/CANCELLED). Portail public /#ambassadeur (AmbassadorPortal.tsx : recrutement + dashboard + Kit de Survie 3 scripts WhatsApp ambassadorKit.ts). Onglet console 'ambassadeurs' (classement, paie, suspendre).
5. RÈGLE 48H (migration 005 appliquée) : case d'acceptation OBLIGATOIRE à l'enrôlement (server TERMS_REQUIRED, col ambassadors.commission_terms_accepted_at) — commission versée uniquement après confirmation + 48h de traitement. Stats SQL séparées : to_pay_usd (mûri), in_hold_usd (délai), paid_usd. Le bouton Payer ne verse jamais une commission en délai.
6. PUSH SERVEUR VAPID : table push_subscriptions (audience ADMIN/AMBASSADOR), src/server/pushService.ts (web-push, no-op si clés absentes, purge 404/410). Déclencheurs : /api/register → notifyAdminNewPayment ; /api/admin/confirm-payment → notifyAmbassadorSale. Routes /api/push/public-key|subscribe|unsubscribe. Client : subscribeWebPush() dans pwaNotifications.ts ; bouton activation sur portail ambassadeur + console. Clés VAPID déjà générées dans .env local (à recopier dans Vercel).
7. Futur planifié (demandé par le client, PAS encore codé) : portail post-atelier public (étudiant passe un test via code billet + télécharge certificat PDF) + IA (@google/genai installé, jamais importé ; OCR preuves Orange Money ; aiService.ts centralisé côté serveur).

RÈGLES DU PROJET :
- Base : Neon. CETTE MACHINE ne peut PAS joindre le port 5432 (TLS reset) → pour les migrations utiliser `npm run db:migrate:ws` (scripts/run-neon-migrations-ws.ts, @neondatabase/serverless sur wss://443, marche à 100%).
- Migration runner : fichiers neon/migrations/*.sql versionnés, appliqués au boot ET via db:migrate:ws. Leçon : toute nouvelle valeur d'enum audit_action_enum doit être ajoutée DANS une migration (sinon la transaction métier rollback).
- Toute écriture métier critique = transaction avec FOR UPDATE + audit_logs (enum actionType, à étendre dans types/index.ts + migration).
- Le formulaire d'inscription doit rester LÉGER ; les fonctionnalités lourdes (tests, certificats) vont sur le site public.
- Le client gère ses formations MANUELLEMENT via le CMS (FormationEditor.tsx) : ne jamais réintroduire de presets automatiques.
- web-push et @google/genai sont des CJS : importer en `import * as x from '...'`.
- Certains fichiers ont été modifiés en externe par le client (scanner natif BarcodeDetector dans AdminPortal) : TOUJOURS relire avant d'éditer, jamais présumer du contenu.
- Validation après chaque chantier : `npm run lint` (tsc) puis `npm run build`, et vérification DB via script temporaire tsx sur canal WS.
- UI 100% FR, thème dual light/dark, palette #E50914 / noir / blanc, classes Tailwind inline, fontes font-montserrat/font-inter/font-mono.

DÉMARRE par : lire src/types/index.ts, src/server/neonStore.ts, src/server/app.ts, src/services/api.ts pour caler le style, puis attends mes instructions.