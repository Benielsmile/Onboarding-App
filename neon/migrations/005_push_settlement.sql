-- ============================================================================;
-- 005_push_settlement.sql — Notifications push VAPID + délai de traitement 48h
-- - push_subscriptions : terminaux ambassadeurs & Direction (web-push W3C)
-- - ambassadors.commission_terms_accepted_at : condition d'acceptation
--   obligatoire à l'enrôlement (commission versée uniquement après
--   confirmation du paiement + délai de traitement de 48h)
-- ============================================================================;

-- 1. ABONNEMENTS PUSH (W3C Web Push / VAPID) ---------------------------------
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    audience TEXT NOT NULL CHECK (audience IN ('ADMIN', 'AMBASSADOR')),
    -- Cible : ambassadeur précis (alertes ventes) ou Direction (nouvelles inscriptions)
    ambassador_id UUID REFERENCES public.ambassadors(id) ON DELETE CASCADE,
    admin_id TEXT,

    -- Clés d'abonnement W3C PushSubscription
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,

    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    last_notified_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_audience
    ON public.push_subscriptions (audience, ambassador_id);

-- 2. ACCEPTATION DES CONDITIONS DE COMMISSION --------------------------------
-- L'ambassadeur reconnaît que sa commission sera versée UNIQUEMENT après :
--   (1) la confirmation du paiement Orange Money de son affilié par la Direction
--   (2) un délai de traitement de 48 heures après ce paiement (anti-fraude /
--       laisser le temps au processing : contrôle de preuve, réclamations)
ALTER TABLE public.ambassadors
    ADD COLUMN IF NOT EXISTS commission_terms_accepted_at TIMESTAMPTZ;

-- Backfill doux : ambassadeurs créés avant cette règle (considérés acceptés)
UPDATE public.ambassadors
SET commission_terms_accepted_at = created_at
WHERE commission_terms_accepted_at IS NULL;
