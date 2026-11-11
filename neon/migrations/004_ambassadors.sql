-- ============================================================================;
-- 004_ambassadors.sql — Infrastructure d'affiliation PIGA STUDIO
-- Pivot ONEPLUS_hub -> PIGA STUDIO : armée d'ambassadeurs officiels rémunérés
-- (commission snapshot par vente VALIDÉE Orange Money), tracking de clics
-- dédupliqué et versements tracés dans le journal d'audit immuable.
-- ============================================================================;

-- 1. REGISTRE DES AMBASSADEURS -----------------------------------------------
CREATE TABLE IF NOT EXISTS public.ambassadors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Code d'affiliation du lien magique (?ref=AMB-XXXX)
    code TEXT NOT NULL UNIQUE,

    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone_international VARCHAR(12) NOT NULL CHECK (length(phone_international) = 12),

    -- Commission snapshot au moment de la création (15% par défaut)
    commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0.1500,

    -- Canal de paiement des commissions (Orange Money RDC par défaut)
    payout_provider TEXT NOT NULL DEFAULT 'ORANGE_MONEY',
    payout_number TEXT,

    status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED')),

    notes TEXT,

    -- Anti-abus : plafond de création par IP (service public de recrutement)
    created_from_ip TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_by TEXT NOT NULL DEFAULT 'SELF_REGISTERED'
);

CREATE INDEX IF NOT EXISTS idx_ambassadors_phone ON public.ambassadors(phone_international);
CREATE INDEX IF NOT EXISTS idx_ambassadors_created_at ON public.ambassadors(created_at DESC);

-- 2. TRACKING DES CLICS DÉDUPLIQUÉ -------------------------------------------
-- Un clic unique par ambassadeur + jour + IP (anti-gonflage des statistiques)
CREATE TABLE IF NOT EXISTS public.ambassador_clicks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ambassador_id UUID NOT NULL REFERENCES public.ambassadors(id) ON DELETE CASCADE,
    click_day DATE NOT NULL DEFAULT (timezone('utc'::text, now())::date),
    ip_hash TEXT NOT NULL,
    user_agent TEXT,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ambassador_clicks_dedupe
    ON public.ambassador_clicks (ambassador_id, click_day, ip_hash);

CREATE INDEX IF NOT EXISTS idx_ambassador_clicks_ambassador
    ON public.ambassador_clicks(ambassador_id, clicked_at DESC);

-- 3. ATTRIBUTION DES INSCRIPTIONS --------------------------------------------
ALTER TABLE public.participants
    ADD COLUMN IF NOT EXISTS ambassador_code TEXT,
    ADD COLUMN IF NOT EXISTS ambassador_id UUID REFERENCES public.ambassadors(id),
    ADD COLUMN IF NOT EXISTS commission_usd NUMERIC(10,2),
    ADD COLUMN IF NOT EXISTS commission_status TEXT CHECK (commission_status IN ('PENDING', 'EARNED', 'PAID', 'CANCELLED')),
    ADD COLUMN IF NOT EXISTS commission_paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_participants_ambassador
    ON public.participants(ambassador_id, commission_status);

-- 4. JOURNAL D'AUDIT : nouvelles actions Direction ----------------------------
DO $$ BEGIN
    ALTER TYPE public.audit_action_enum ADD VALUE IF NOT EXISTS 'AMBASSADOR_CREATE';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE public.audit_action_enum ADD VALUE IF NOT EXISTS 'AMBASSADOR_PAYOUT';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TYPE public.audit_action_enum ADD VALUE IF NOT EXISTS 'AMBASSADOR_SUSPEND';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 5. Désambiguïsation anti-abus du recrutement public :
-- un numéro WhatsApp ne peut correspondre qu'à UN ambassadeur actif.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ambassadors_phone_active
    ON public.ambassadors (phone_international)
    WHERE status = 'ACTIVE';
