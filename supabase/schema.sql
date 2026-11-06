-- ============================================================================
-- ARSENAL AGENTIQUE 2026 - PRODUCTION DATABASE SCHEMA & DEVSECOPS SECURITY SPEC
-- Standards: IBM Secure-by-Design, Microsoft/Amazon AI SaaS Architectures, OWASP Top 10
-- Target Date: Vendredi 13 Novembre 2026
-- ============================================================================

-- 1. Enable Cryptographic & UUID Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Enumerated Status Types
DO $$ BEGIN
    CREATE TYPE participant_status_enum AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');
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
      'DOWNLOAD_TICKET',
      'VIEW_PROOF',
      'RESEND_WHATSAPP',
      'ADMIN_LOGIN'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Master Inventory & Seat Capacity (Transactional Row-Level Locking)
CREATE TABLE IF NOT EXISTS public.masterclass_inventory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_date DATE NOT NULL DEFAULT '2026-11-13',
    total_capacity INTEGER NOT NULL DEFAULT 80,
    confirmed_seats INTEGER NOT NULL DEFAULT 0,
    pending_holds INTEGER NOT NULL DEFAULT 0,
    ticket_price_usd NUMERIC(10,2) NOT NULL DEFAULT 20.00,
    version INTEGER NOT NULL DEFAULT 1,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    CONSTRAINT check_capacity CHECK (confirmed_seats + pending_holds <= total_capacity),
    CONSTRAINT check_ticket_price CHECK (ticket_price_usd = 20.00)
);

-- Seed initial masterclass inventory if not exists
INSERT INTO public.masterclass_inventory (event_date, total_capacity, confirmed_seats, pending_holds, ticket_price_usd)
SELECT '2026-11-13', 80, 0, 0, 20.00
WHERE NOT EXISTS (SELECT 1 FROM public.masterclass_inventory WHERE event_date = '2026-11-13');

-- 4. Participants Table (Preserving raw user layout, encrypting sensitive PII at rest)
CREATE TABLE IF NOT EXISTS public.participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    full_name TEXT NOT NULL,
    
    -- Encrypted PII Fields at rest using PGP or Application-level AES-256
    email_encrypted TEXT NOT NULL,
    email_blind_index TEXT NOT NULL, -- SHA-256 HMAC hash for indexed duplicate checking without exposing plaintext
    
    phone_raw TEXT NOT NULL,
    phone_international VARCHAR(12) NOT NULL, -- Strict DRC Format "243XXXXXXXXX"
    phone_blind_index TEXT NOT NULL,
    network_carrier VARCHAR(40) NOT NULL,
    
    -- Financials & Verification
    price_usd NUMERIC(10,2) NOT NULL DEFAULT 20.00,
    payment_provider momo_provider_enum NOT NULL,
    transaction_reference TEXT NOT NULL,
    
    -- Private storage reference for MoMo payment screenshot
    proof_storage_path TEXT NOT NULL,
    
    -- Non-Disclosure & Legal Agreement
    nda_accepted BOOLEAN NOT NULL DEFAULT true,
    nda_accepted_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    
    -- Registration Lifecycle
    status participant_status_enum NOT NULL DEFAULT 'PENDING',
    ticket_code VARCHAR(32) UNIQUE,
    crypto_token TEXT, -- AES-256-GCM encrypted token { t, n, d: "2026-11-13", s: "CONFIRMED" }
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    confirmed_at TIMESTAMPTZ,
    admin_notes TEXT,
    
    CONSTRAINT check_enforced_price CHECK (price_usd = 20.00),
    CONSTRAINT check_drc_phone_length CHECK (length(phone_international) = 12)
);

CREATE INDEX IF NOT EXISTS idx_participants_email_hash ON public.participants(email_blind_index);
CREATE INDEX IF NOT EXISTS idx_participants_phone_intl ON public.participants(phone_international);
CREATE INDEX IF NOT EXISTS idx_participants_status ON public.participants(status);
CREATE INDEX IF NOT EXISTS idx_participants_ticket_code ON public.participants(ticket_code);

-- 5. Immutable Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id TEXT NOT NULL,
    action_type audit_action_enum NOT NULL,
    participant_id UUID REFERENCES public.participants(id) ON DELETE SET NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    user_agent TEXT NOT NULL,
    ip_address INET,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_participant ON public.audit_logs(participant_id);

-- 6. Row Level Security (RLS) Policies
ALTER TABLE public.participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.masterclass_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Anonymous users may only view remaining seat availability count, never attendee data
CREATE POLICY "Public read inventory availability" ON public.masterclass_inventory
    FOR SELECT TO anon, authenticated
    USING (true);

-- Anonymous users can submit registration via server action (Zero-Trust validated)
CREATE POLICY "Anon can insert participant" ON public.participants
    FOR INSERT TO anon, authenticated
    WITH CHECK (
        price_usd = 20.00 
        AND status = 'PENDING'
        AND nda_accepted = true
    );

-- Only authenticated staff admins can query participants table
CREATE POLICY "Admins full access to participants" ON public.participants
    FOR ALL TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' LIKE '%@arsenal-agentique.tech');

-- Audit logs are strictly append-only (immutable): no update or delete even for admins
CREATE POLICY "Admins can view audit logs" ON public.audit_logs
    FOR SELECT TO authenticated
    USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "System can append audit logs" ON public.audit_logs
    FOR INSERT TO authenticated, anon
    WITH CHECK (true);

-- 7. High-Concurrency Transaction with Row-Level Locking (SELECT FOR UPDATE)
-- Blocks concurrent duplicate submissions and guarantees inventory integrity
CREATE OR REPLACE FUNCTION public.register_participant_atomic(
    p_full_name TEXT,
    p_email_enc TEXT,
    p_email_hash TEXT,
    p_phone_raw TEXT,
    p_phone_intl VARCHAR(12),
    p_phone_hash TEXT,
    p_carrier VARCHAR(40),
    p_provider momo_provider_enum,
    p_tx_ref TEXT,
    p_proof_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_inv RECORD;
    v_new_participant_id UUID;
    v_ticket_code VARCHAR(32);
BEGIN
    -- 1. Acquire exclusive Row-Level Lock on inventory table to prevent race conditions
    SELECT * INTO v_inv
    FROM public.masterclass_inventory
    WHERE event_date = '2026-11-13'
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Configuration d''inventaire introuvable pour la session du 13 Novembre 2026.';
    END IF;

    -- 2. Verify remaining capacity
    IF (v_inv.confirmed_seats + v_inv.pending_holds) >= v_inv.total_capacity THEN
        RAISE EXCEPTION 'Capacité maximale atteinte pour cette session. Enregistrement bloqué.';
    END IF;

    -- 3. Check for existing duplicate registration within active pool
    IF EXISTS (
        SELECT 1 FROM public.participants 
        WHERE (email_blind_index = p_email_hash OR phone_international = p_phone_intl)
        AND status IN ('PENDING', 'CONFIRMED')
    ) THEN
        RAISE EXCEPTION 'Une inscription avec cet e-mail ou ce numéro WhatsApp est déjà enregistrée.';
    END IF;

    -- 4. Generate unique serial number ticket code
    v_ticket_code := 'AA-2026-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6)) || '-' || SUBSTRING(p_phone_intl FROM 10 FOR 3);

    -- 5. Insert participant record
    INSERT INTO public.participants (
        full_name,
        email_encrypted,
        email_blind_index,
        phone_raw,
        phone_international,
        phone_blind_index,
        network_carrier,
        price_usd,
        payment_provider,
        transaction_reference,
        proof_storage_path,
        nda_accepted,
        status,
        ticket_code
    ) VALUES (
        p_full_name,
        p_email_enc,
        p_email_hash,
        p_phone_raw,
        p_phone_intl,
        p_phone_hash,
        p_carrier,
        20.00, -- Enforced price
        p_provider,
        p_tx_ref,
        p_proof_path,
        true,
        'PENDING',
        v_ticket_code
    )
    RETURNING id INTO v_new_participant_id;

    -- 6. Atomically increment pending holds
    UPDATE public.masterclass_inventory
    SET pending_holds = pending_holds + 1,
        version = version + 1,
        updated_at = timezone('utc'::text, now())
    WHERE id = v_inv.id;

    RETURN jsonb_build_object(
        'success', true,
        'participant_id', v_new_participant_id,
        'ticket_code', v_ticket_code,
        'status', 'PENDING'
    );
EXCEPTION
    WHEN OTHERS THEN
        -- PostgreSQL automatically rolls back the atomic transaction
        RAISE;
END;
$$;
