-- ============================================================================;
-- 003_wipe_support.sql — Actions d'audit Post-Atelier
-- Le nettoyage post-atelier journalise RESET_WORKSHOP_DATA et l'export PDF
-- journalise EXPORT_DASHBOARD_PDF ; les deux valeurs doivent exister dans
-- l'énumération immuable audit_action_enum posée par 001_init.sql.
-- ============================================================================;

-- Valeur pour l'export du rapport PDF du dashboard
DO $$ BEGIN
    ALTER TYPE public.audit_action_enum ADD VALUE IF NOT EXISTS 'EXPORT_DASHBOARD_PDF';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Valeur pour le nettoyage post-atelier (wipe de la billetterie)
DO $$ BEGIN
    ALTER TYPE public.audit_action_enum ADD VALUE IF NOT EXISTS 'RESET_WORKSHOP_DATA';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
