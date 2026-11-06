-- ============================================================================
-- SUPABASE STORAGE ISOLATION & PRIVATE BUCKET POLICIES
-- Target: 'payment-proofs' private encrypted bucket
-- ============================================================================

-- 1. Create Private Bucket (Public = False)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'payment-proofs',
    'payment-proofs',
    false, -- STRICTLY PRIVATE
    10485760, -- 10MB maximum file size limit
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760;

-- 2. Storage Security Policies
-- Anyone (anonymously during registration) can upload a screenshot to the designated upload path
CREATE POLICY "Allow public upload to payment-proofs"
ON storage.objects FOR INSERT TO anon, authenticated
WITH CHECK (
    bucket_id = 'payment-proofs' 
    AND (storage.extension(name) = 'jpg' OR storage.extension(name) = 'png' OR storage.extension(name) = 'webp')
);

-- Public READ access is STRICTLY FORBIDDEN.
-- Direct downloads without a cryptographic signed URL are denied.
CREATE POLICY "Deny unauthenticated public read"
ON storage.objects FOR SELECT TO anon
USING (false);

-- Only authenticated staff admins can generate signed URLs or read files directly
CREATE POLICY "Admins can access payment proofs"
ON storage.objects FOR SELECT TO authenticated
USING (
    bucket_id = 'payment-proofs' 
    AND (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'email' LIKE '%@arsenal-agentique.tech')
);

-- Only admins can delete or update storage objects
CREATE POLICY "Admins can manage objects"
ON storage.objects FOR DELETE TO authenticated
USING (
    bucket_id = 'payment-proofs' 
    AND auth.jwt() ->> 'role' = 'admin'
);
