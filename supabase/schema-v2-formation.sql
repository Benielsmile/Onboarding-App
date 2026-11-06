-- ============================================================================
-- PIGA STUDIO — SCHEMA V2 : MULTI-FORMATIONS & LIAISON BASE DE DONNÉES
-- Pont prêt à l'emploi entre le registre persistant (data/formations.json)
-- et Supabase. Exécuter APRÈS schema.sql / storage.sql.
--
-- Correspondance côté application (src/types/index.ts) :
--   formations.config  <-> ProgramConfig (JSONB complet)
--   participants.program_id <-> Participant.programId
--   participants (encodage) : phone_international, email, full_name, price_usd,
--                             payment refs, NDA, ticket_code, crypto_token
-- ============================================================================

-- 1. Extensions sécuritaires
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enums : aligner RÉVOKED (révocation de réservation Orange Money)
DO $$ BEGIN
    ALTER TYPE participant_status_enum ADD VALUE IF NOT EXISTS 'REVOKED';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'REVOKE_RESERVATION';
    ALTER TYPE audit_action_enum ADD VALUE IF NOT EXISTS 'UPDATE_PROGRAM_CONFIG';
EXCEPTION
    WHEN duplicate_object THEN NULL;
    WHEN undefined_object THEN NULL;
END $$;

-- 3. Table FORMATIONS (registre permanent des formations / landing pages)
CREATE TABLE IF NOT EXISTS public.formations (
    id TEXT PRIMARY KEY,                              -- ex: 'arsenal-agentique-2026'
    title TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMING_SOON'
        CHECK (status IN ('OPEN','COMING_SOON','SOLD_OUT')),
    date_display TEXT,
    ticket_price_usd NUMERIC(10,2) NOT NULL DEFAULT 20.00,
    total_capacity INTEGER NOT NULL DEFAULT 50,
    config JSONB NOT NULL,                            -- ProgramConfig complet (landing page, modules, NDA…)
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Une seule formation active à la fois
CREATE OR REPLACE FUNCTION public.enforce_single_active_formation()
RETURNS trigger AS $$
BEGIN
    IF (NEW.is_active) THEN
        UPDATE public.formations SET is_active = FALSE WHERE id <> NEW.id AND is_active;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_single_active_formation ON public.formations;
CREATE TRIGGER trg_single_active_formation
    BEFORE INSERT OR UPDATE OF is_active ON public.formations
    FOR EACH ROW EXECUTE FUNCTION public.enforce_single_active_formation();

-- Index de lecture publique
CREATE INDEX IF NOT EXISTS idx_formations_status ON public.formations(status, updated_at DESC);

-- 4. Participants : lien vers la formation d'appartenance
ALTER TABLE public.participants
    ADD COLUMN IF NOT EXISTS program_id TEXT REFERENCES public.formations(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_participants_program ON public.participants(program_id, status);

-- 5. Journal d'audit : immuable (append-only via RLS côté Supabase)
ALTER TABLE public.audit_logs
    ADD COLUMN IF NOT EXISTS program_id TEXT;

CREATE INDEX IF NOT EXISTS idx_audit_program ON public.audit_logs(program_id, "timestamp" DESC);

-- ============================================================================
-- NOTES D'INTÉGRATION (prochaine étape de liaison réelle) :
-- 1. Configurer SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY dans le .env
-- 2. Créer un client Supabase côté serveur (import { createClient } from '@supabase/supabase-js')
-- 3. Adaptor recommandé :
--    - registerParticipant -> INSERT participants (RETURNING row)
--    - confirmPayment / rejectPayment / revoke -> UPDATE status + INSERT audit_logs
--    - getFormationStats -> vues SQL agrégées (recettes, conversion, opérateurs)
--    - registre formations -> migrations data/formations.json vers public.formations
--    Le mapper JSON <-> JSONB reste transparent (mêmes clés ProgramConfig).
-- ============================================================================
