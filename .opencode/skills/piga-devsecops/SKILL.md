---
name: piga-devsecops
description: >
  SKILL DEVSECOPS OPÉRATIONNEL — La méthodologie complète de test, d'audit
  et de durcissement de sécurité conçue et PROUVÉE sur l'app PIGA STUDIO
  (pentest réel avec certification d'exploitation). Expliquée pour tout
  humain, intégrable dans toute infrastructure de dev existante (solo,
  startup, agence, entreprise). À utiliser quand l'utilisateur demande :
  tester la sécurité, faire un pentest, auditer, durcir/devsecops-er une
  app, réagir à un incident, préparer une mise en prod, ou intégrer une
  sécurité dans un workflow existant.
---

# 🛡️ SKILL DEVSECOPS PIGA — Le plan de survie de votre application

---

## §0. PITCH DE L'ARCHITECTE (lisez-le debout)

Vous vendez en ligne. Vous encaissez. Vous stockez des données de personnes
vivantes. Chaque fonctionnalité que vous ajoutez est une **porte que quelqu'un
essaie d'ouvrir en ce moment** — un concurrent qui veut vider vos sièges de
billets, un fraudeur qui veut vos preuves de paiement, un curieux qui veut les
téléphones de vos clients, un bot qui veut forcer votre console admin.

Le jour où ça casse, vous ne perdez pas un bug. Vous perdez :
- l'argent des ventes (billets drainés ou volés),
- la preuve des paiements (transferts Orange Money non vérifiables),
- la confiance (رسائل WhatsApp aux clients : "votre application m'a volé"),
- votre marque (PIGA STUDIO = marque de "blindage" — imaginez le scandale),
- parfois, légalement : la responsabilité des données personnelles (PII).

**Ce skill n'est pas une ceinture à pendant. C'est un kit de survie :**
cinq phases, des portières verrouillées à l'usine, un test à chaque livraison,
et les réflexes pour réagir avant l'heure. Il vient d'un audit RÉEL où un
"attacker" a pris la console admin en moins de 2 minutes à partir des secrets
publiés du projet. Tout ce qui est écrit ici a été conçu pendant cette
campagne, corrigé, et re-testé. Il est prouvé, pas académique.

**Le contrat :** 30 minutes réparties = un projet blindé aux portes ; chaque
heure de code testée = un intrus en moins. La question n'est pas "est-ce
nécessaire" — c'est "quand ça se passera, voudrez-vous avoir ce réflexe ?"

---

## §1. LA PHILOSOPHIE EN 7 PORTES FERMÉES À L'USINE

| # | Porte | Règle gravée | Coût de négligence (réel, mesuré sur PIGA) |
|---|---|---|---|
| 1 | **Secrets** | Aucun secret dans le code, l'histoire git, ou la doc. Tout dans les variables d'environnement. Exemples = placeholders. | ❌ Compte admin volé en 2 min (credentials publiés dans un repo public + retrouvables dans l'historique git) |
| 2 | **Authentification** | Login limité (5/min/IP), mot de passe 🔑 long aléatoire géré par password-manager, alerte à partir de 6 échecs/15 min | 30 tentatives/s possibles sans limite (mesuré : 30 essais en 56 ms) |
| 3 | **Autorisation** | Toute action sensible derrière une session vérifiée — y compris le "générateur de signatures" et les serveurs de fichiers privés | Preuve de paiement privée exfiltrée via un signing public (F-03, reproduit) |
| 4 | **Resources** | Rate-limit sur TOUTES les actions publiques qui coûtent (inscription = sièges) | 80 sièges · 20$ drainables par un bot en une boucle (F-04, reproduit) |
| 5 | **Transport** | TLS vérifié (jamais `rejectUnauthorized:false`), HSTS, CSP | MITM preuve de paiement en transit |
| 6 | **Sobriété & Head errors** | JSON body limit bas, catch-all error middleware, jamais d'URL → 500 brut | URIError => express crash logs + fuite possible |
| 7 | **Traçabilité** | Audit log append-only : chaque DENIED/GRANTED/action/wipe ; alertes claires console | Aucun moyen de savoir qu'on est en ligne de mire |

**Ces 7 portes sont implémentées dans PIGA STUDIO via `src/server/app.ts` (rate
limiter maison, gateway admin, guard UAV signed-url, headers, catch-all) —
copiez ce modèle 1:1 dans vos projets.**

---

## §2. LA PIPELINE 5 PHASES (votre machine DevSecOps)

Chaque phase a un dossier de travail, un produit livrable et un GO/NO-GO.

```
[P1 INVENTAIRE] → [P2 STATIQUE] → [P3 DYNAMIQUE (sandbox)] → [P4 RAPPORT] → [P5 REMÉDIER+DURCIR] → boucle P3
     (surface)      (secrets/dep)      (vrai code, DB factice)       (gravements)      (correctifs+fiche run)     (re-teste)
```

### Phase 1 — INVENTAIRE (30 min)
- Cartographier la surface : chaque clé API, chaque endpoint, chaque repo (public/private), chaque service (hosting, DB, CDN, mail), chaque secret détenu. La conduite exemple est dans `src/server/app.ts` (toutes les routes sont documentées dans le SKILL de réplication §5).
- **Livrable : `ASSETS-INVENTORY.md`** (liste + propriétaire + criticité).
- **GO/NO-GO :** rien n'est "mineur" tant qu'il n'est pas écrit.

### Phase 2 — STATIQUE (1 h)
1. **Secrets :** `git grep` sur tous les blobs de l'HISTOIRE (pas juste le HEAD) :
   ```pwsh
   git clone --bare https://github.com/VOTRE-RPO/repo.git tmp-bare
   npx gitleaks git tmp-bare          # push protection + full scan
   # ou manuellement : git log --all --diff-filter=A -- '*.pem' '*.key' '.env*'
   node -e "…gitleaks…"               # préférer : gitleaks détect + pré-commit
   ```
2. **Dépendances :** `npm audit --audit-level=moderate` (CI-blocking) + `npm outdated` trimestriel.
3. **Revue crypto :** une seule implémentation de crypto vérifiée (AES-256-GCM + MAC), jamais MD5/SHA1, jamais `Math.random()` pour des tokens. Chez PIGA : AES-256-GCM + HMAC-SHA256 + timingSafeEqual — audit impossible à bypasser.
4. **Config de déploiement :** headers, secrets, dashboard "poussée" (ex. `rejectUnauthorized: false` = 🚨 crème jaune immédiate).
- **Livrable : liste F-xx statiques (cote de gravité)**.

### Phase 3 — DYNAMIQUE SANDBOX (1-2 h) — LA TECHNIQUE QUI CHANGE TOUT
**Tester le code RÉEL, jamais la production.** Astuce PIGA (généralisable) :
1. Sert le code réel avec une base factice locale intégrée :
   ```ts
   npm install --save-dev embedded-postgres   # PG 18 local, 0 installation
   // scripts/pentest-boot.ts : démarre PG sur 127.0.0.1:5433 → injecte les env
   // (DATABASE_URL loaux, POST_CREDENTIALS de test) → createTheApp() réel → listen
   ```
2. Exécute la suite d'attaque **comme un attaquant** (via `fetch` — cf. suite PIGA) :
   - **A1 Credential stuffing** : collez les credentials publics/x-leakés → login ?
   - **A2 Brute force** : 30 connexions rapides → pas de 429 ? pas de lockout ?
   - **A3 Elevation via tools publics** : chaque endpoint "generator/signer/verify" doit exiger la session — attaque avec un ZÉRO cookie.
   - **A4 Business logic** : remplir la capacité, dupliquer, rejouer, mauvais montant, IDOR sur liens d'universe privés.
   - **A5 Exfiltration** : chaque fichier/jeton cherché sans auth ; tamper les tokens ; vérif expiration.
   - **A6 DoS léger** : body taille max, chaînes énormes, URLs malformées (BAD.TOKEN.%% → 500 brut ?).
3. **Chronomètre chaque attaque.** Un "T+0:00 → T+2:00 root" écrit dans le rapport frappe les décideurs.

- **GO/NO-GO :** chaque vulnérabilité reproduite = un F-xx avec preuve exacte (réponses HTTP brutes).

### Phase 4 — RAPPORT (1 h) — Format d'évidence PIGA
Section EXÉCUTIVE (verdict en tableau) → F-xx numérotés (sévérité 🔴🟠🟡 + preuve
copiable + effet métier + remède concis) → "CE QUI TIENT" (toujours — crédite le
bien-fait) → timeline d'attaque T+0:00 → plan quand/comment (48h/7j/30j).
Un rapport sans preuve reproductible n'est pas un rapport : c'est une opinion.

### Phase 5 — REMÉDIER PLUS DURCIR (les moves récents)
1. Corriger en code (porte-fenêtre PIGA : rate limiter maison, decoder store hash-only,
   protect Bearer sur signed-url, CSP/HSTS/Permissions-Policy, catch-all 400 JSON, body 12mb),
2. Verrouiller l'OPÉRATION (les 2 actions non-codables — cf §4),
3. **BLOUCLER : re-exécuter P3 complet** — un fix non re-testé n'existe pas.
4. Documenter "STATUT" dans le rapport daté (pivot de confiance direction).

---

## §3. RUNBOOKS DE SURVIE (copiez-les aujourd'hui)

### R1 — ROTATION SECRET COMPROMIS (exécuté en 15 min, pas à pas)
```pwsh
# 1. Générer un mot de passe passi de 24+ : password-manager → pas de chat/IA
# 2. Vercel → Settings → Environment Variables → ADMIN_PASSWORD → Replace → redeploy
# 3. Purger l'historique Git PUBLIÉ (do it calmement, sur repo non-distribué ou quelle sync team):
git clone --bare https://github.com/VOUS/repo.git wipe.git
cd wipe.git
npx --yes git-filter-repo --path .env.example --invert-paths --force
git remote set-url origin https://github.com/VOUS/repo.git
git push --force --all ; git push --force --tags
cd .. ; Remove-Item -Recurse wipe.git
# 4. GitHub → Settings → Code security → Secret scanning + Push protection → ACTIVER
# 5. Si une clé DB/API a fuité : rotation chez le fournisseur (Neon: Settings→Reset password)
```

### R2 — INCIDENT EN COURS (détecté via audit/console)
1. Couper : `vercel deployments rollback` ou désactiver la route dans Vercel Firewall (Block).
2. Préserver la preuve : export audit_logs + snapshot DB avant tout nettoyage.
3. Coucher l'incident en 10 lignes : quoi/quand/comment/impact/déjà fait/suite.
4. Jours d'après : re-tour Phase 3 sur la portion ciblée + allonger les portes §1.

### R3 — NOUVELLE FEATURE = NOUVELLE PORTE (DevSecOps dans le sprint)
Chaque PR répond : 1) exige une session ? 2) une entrée mutée (money/status) est limitée ? 3) résultat paramétré ? 4) le log d'audit raconte-le ? 5) secret manipulé est dans l'env ? Si une réponse = "je ne sais pas" → non mergé.

---

## §4. L'INTÉGRATION DANS VOTRE INFRASTRUCTURE EXISTANTE (10 min chacun)

| Vous avez… | Intégration immédiate |
|---|---|
| GitHub + Vercel/Netlify (le cas PIGA) | 1) `npx gitleaks detect` dans une Action CI sur PR ; 2) Vercel Firewall : rule BLOCK >20 POST/min sur `/api/admin/*` + `/api/register` (sécurise même si le code rate-limiter ne tient pas entre colds) ; 3) Audit log → alerte Slack/Telegram via un petit watchdog sur console (§Great) |
| Repo avec PRs | Obliger la checklist R3 en template de PR + 1 reviewer (humain OU robot type CodeRabbit/ESC Copilot) |
| Containers/infra as code | `docker scan` / trivy images ; secrets via Vault/Doppler ; jamais dans IaC |
| Any language (Python/Go/Java) | Le pipeline P1→P5 + la philosophie §1 sont langage-agnostique ; seules les implémentations (rate limiter, crypto) s'écrivent dans votre stack — le modèle app.ts reste la référence d'or |

**Le skill est un SQUELETTE : il accompagne n'importe quel projet existant
sans le réécrire. Les phases s'exécutent sur VOTRE code tel quel.**

---

## §5. LES AVANTAGES (ce que vous gagnez, chiffré)

1. **Survie commerciale** : fingerprint anti-drain → votre inventaire de billets ne peut plus être vidé par un bot (F-04 bléché). Une seule campagne protégée paie l'audit à vie.
2. **Confidentialité provable** : preuves de paiement et PII non exfiltrables sans session (F-03 clos) — argument client direct (et conformité PPD/GDPR en route).
3. **Continuité** : plan d'incident + rollback tracé → 10 min pour geler, 2 h pour comprendre, au lieu d'une semaine d'urgence improvisée.
4. **Crédibilité** : un rapport daté avec preuves + STATUT "corrigé & re-testé" = dossier showable à un investisseur, un client et un掉的 entreprise.
5. **Vitesse inversée** : chaque porte fermée à l'USINE ne coûte rien per-feature ; chaque porte ouverte découverte plus tard coûte un emergency + rotation + rebuild de confiance (le coût du pentest est 10× inférieur au coût de l'incident évité).
6. **Équipe épanouie** : développeur junior dira "je garde la checklist" sans peur ; le code existant devient une REFERENCE d'or pour l'équipe qui arrive.

---

## §6. CE QUI MANQUE ENCORE (à intégrer dès que le volume le justifie — disons "réalisme")

L'honnêteté fait partie du skill. Voici ce que PIGA STUDIO N'A PAS YET, par ordre :

| # | Manque | Quand le faire | Effort |
|---|---|---|---|
| 1 | **WAF réseau (Cloudflare devant Vercel)** | Dès la 1re annonce virale / 1re attaque visible | 1h (DNS) |
| 2 | **CAPTCHA invisible (Turnstile) sur l'inscription** | Dès que F-04 attack recurrence malgré rate-limit | 2h |
| 3 | **Backups DB automatiques + test de restore** | Immédiat (Neon branch point-in-time ; tester 1 restauration/mois) | 1h |
| 4 | **Monitoring & alerte métier** (push/Telegram sur 429/DENIED/wipe) | Avec le premier événement | 3h |
| 5 | **MFA/2FA sur la console admin** (WebAuthn) | Dès qu'un 2e équipeataire touche la console | 4h |
| 6 | **Declaration d'incident écrite + contacts d'urgence** | 1 jour de rédaction | court |
| 7 | **Chiffrement at-rest des preuves (F-08)** — AES-256-GCM sur `stored_files` | Avant 1 000 participants en base | 1 journée |
| 8 | **Pentest externe indépendant annuel** | Avant tout gros client B2B/entreprise | contractuel |
| 9 | **CI pipeline complet** (lint + tests + audit + vulta scan) | Dès 2 devs | 1 journée |
| 10 | **Isolation réseau/vpc review + span DB user non-owner** | Enterprise | moyen |

---

## §7. MÉTHODE D'EMPLOI POUR UN HUMAIN (même non-codeur)

1. **Ouvrez** ce fichier avec votre outil (Claude/Opencode — il est déjà enregistré
   comme skill `piga-devsecops` dans `.opencode/skills/` et `.claude/skills/`).
2. **Dites simplement** :
   - *"Fais un audit DevSecOps de mon projet avec le skill"* → la pipeline complète s'exécute,
   - *"Intègre ta sécurité DevSecOps dans mon pipeline existant"* → vous obtenez les templates CI + règles firewall,
   - *"Un incident est en cours en production"* → runbook R2 exécuté pas-à-pas,
   - *"La phase X a trouvé F-01…"* → plans de remédiation datés.
3. **Chaque phase affiche son GO/NO-GO** — vous êtes l'approbateur, pas le spécialiste.

---

## §8. PREUVE QUE ÇA MARCHE (le dossier PIGA STUDIO, daté 2026-11-07)

- Phase 3 exécutée sur code PRODUCTION réel + database factice PostgreSQL 18 locale (aucun risque prod),
- 6 attaques refluées avec preuves HTTP brutes, une corruption complète reproduite **T+0:00 → T+2:00**,
- Rapport F-01→F-10 avec plan 48h/7j/30j, `SECURITY-PENTEST-REPORT.md`,
- Remédiation phase 5 appliquée + re-checkée : limiter login (5/min), alerte brute-force 6/15min + audit ALARM, signed-url révérouillaillé Bearer + TTL 60s, register 8/h/IP, CSP/HSTS/Permissions-Policy/Referrer, catch-all 400 JSON, body 12mb.
- les 2 actions humaines restantes (rotation mot de passe + purge git) = runbook R1 prêt exécuter.

> **Dernière ligne de l'architecte :** la sécurité n'est pas une électricité à
> mettre à l'extérieur des machines. C'est le plan de survie du commerce —
> et il contient précisément 5 phases, 7 portes, 3 runbooks, et la liste
> honnête de ce qui manque. Tenez ce dossier à jour, et vous tenez votre
> infrastructure. Bonne garde. 🛡️

---
*Dérivé du Dossier DevSecOps réel PIGA STUDIO (projets Onboarding-App).
Places to copy pratiques : `src/server/app.ts` (toutes les portes), `SECURITY-PENTEST-REPORT.md` (modèle de rapport), `PIGA-STUDIO-APP-SKILL.md` (contrat app).*
