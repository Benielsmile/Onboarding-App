-- ============================================================================;
-- 001_init.sql — Schéma fondamental Arsenal Agentique sur NeonDB
-- Appliqué par le runner de migrations (schema_migrations transactions atomiques)
-- ============================================================================

-- 1. Extensions cryptographiques & UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumérations de statut (idempotent natif Neon, mais DO-block défensif)
DO $$ BEGIN
    CREATE TYPE participant_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'REVOKED');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE momo_provider_enum AS ENUM ('M-PESA', 'ORANGE_MONEY', 'AIRTEL_MONEY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE audit_action_enum AS ENUM (
      'CONFIRM_PAYMENT',
      'REJECT_PAYMENT',
      'REVOKE_RESERVATION',
      'DOWNLOAD_TICKET',
      'VIEW_PROOF',
      'RESEND_WHATSAPP',
      'ADMIN_LOGIN',
      'UPDATE_PROGRAM_CONFIG'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- 3. PARTICIPANTS
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,

    email TEXT NOT NULL,
    email_masked TEXT NOT NULL,

    phone_raw TEXT NOT NULL,
    phone_international VARCHAR(12) NOT NULL CHECK (length(phone_international) = 12),
    phone_masked TEXT NOT NULL,
    network_carrier VARCHAR(40) NOT NULL,

    status participant_status_enum NOT NULL DEFAULT 'PENDING',
    program_id TEXT NOT NULL,

    price_usd NUMERIC(10,2) NOT NULL DEFAULT 20.00,
    payment_provider momo_provider_enum NOT NULL DEFAULT 'ORANGE_MONEY',
    transaction_reference TEXT NOT NULL DEFAULT 'N/A',

    proof_file_name TEXT NOT NULL DEFAULT 'screenshot_orange_money.jpg',
    proof_storage_path TEXT NOT NULL,

    nda_accepted BOOLEAN NOT NULL DEFAULT true,
    nda_accepted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),

    ticket_code VARCHAR(32) UNIQUE,
    crypto_token TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    confirmed_at TIMESTAMPTZ,
    admin_notes TEXT,
    revoked_at TIMESTAMPTZ,
    revocation_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_participants_email        ON public.participants(email);
CREATE INDEX IF NOT EXISTS idx_participants_phone_intl   ON public.participants(phone_international);
CREATE INDEX IF NOT EXISTS idx_participants_status       ON public.participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_ticket_code  ON public.participants(ticket_code);
CREATE INDEX IF NOT EXISTS idx_participants_program      ON public.participants(program_id, created_at DESC);

-- Anti-doublon au niveau BDD (un email / un numéro par formation, sauf REJECTED)
CREATE UNIQUE INDEX IF NOT EXISTS uq_participants_email_active
    ON public.participants (program_id, lower(email))
    WHERE status <> 'REJECTED';
CREATE UNIQUE INDEX IF NOT EXISTS uq_participants_phone_active
    ON public.participants (program_id, phone_international)
    WHERE status <> 'REJECTED';

-- ============================================================================
-- 4. FORMATIONS (registre durable — config ProgrammeConfig en JSONB)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.formations (
    id TEXT PRIMARY KEY,
    config JSONB NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT false,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_by TEXT
);

-- Exactement UNE formation active à tout instant
CREATE UNIQUE INDEX IF NOT EXISTS uq_formations_single_active
    ON public.formations ((is_active))
    WHERE is_active;

-- ============================================================================
-- 5. JOURNAUX D'AUDIT IMMUABLES (append-only, géré applicativement)
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id TEXT NOT NULL,
    action_type audit_action_enum NOT NULL,
    participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_agent TEXT NOT NULL,
    ip_address TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp   ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_participant ON public.audit_logs(participant_id);
