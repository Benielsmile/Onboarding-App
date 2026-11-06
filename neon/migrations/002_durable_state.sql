-- ============================================================================
-- 002_durable_state.sql — Passage à un déploiement 100% Stateless :
--   A. Paiement restreint à ORANGE MONEY (reconstruction de l'enum)
--   B. Fichiers durables en base (preuves MoMo→Orange Money + images de
--      formation) : plus aucune dépendance au disque local -> multi-instance
--   C. Sessions administrateur persistées (les logins survivent aux
--      redémarrages et fonctionnent derrière un load balancer)
-- ============================================================================

-- ---------------------------------------------------------------------------
-- A. Enum paiement : uniquement Orange Money
-- ---------------------------------------------------------------------------
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_provider_enum') THEN
        CREATE TYPE payment_provider_enum AS ENUM ('ORANGE_MONEY');
    END IF;
END $$;

-- Normalise toute valeur historique vers Orange Money
DO $$ BEGIN
    IF to_regclass('public.participants') IS NOT NULL AND EXISTS (
        SELECT 1 FROM pg_type WHERE typname = 'momo_provider_enum'
    ) THEN
        UPDATE public.participants
           SET payment_provider = 'ORANGE_MONEY'
         WHERE payment_provider <> 'ORANGE_MONEY'::momo_provider_enum;

        ALTER TABLE public.participants ALTER COLUMN payment_provider DROP DEFAULT;
        ALTER TABLE public.participants
            ALTER COLUMN payment_provider TYPE payment_provider_enum
            USING payment_provider::text::payment_provider_enum;
        ALTER TABLE public.participants
            ALTER COLUMN payment_provider SET DEFAULT 'ORANGE_MONEY';

        DROP TYPE momo_provider_enum;
    END IF;
END $$;

-- ---------------------------------------------------------------------------
-- B. Fichiers durables (preuves de paiement & images de formation)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stored_files (
    path TEXT PRIMARY KEY,              -- ex: 'proofs/<formation>/<id>.jpg' ou 'uploads/img-xxx.jpg'
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    data BYTEA NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_stored_files_created ON public.stored_files(created_at DESC);

-- ---------------------------------------------------------------------------
-- C. Sessions administrateur (hash du Bearer, TTL 12h, purge applicative)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_sessions (
    token_hash TEXT PRIMARY KEY,        -- SHA-256 du token Bearer (jamais le token brut)
    admin_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON public.admin_sessions(expires_at);
