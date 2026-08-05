-- Crea il bucket "mail-assets" per i loghi delle mail marketing
-- Eseguire nel SQL Editor di Supabase

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'mail-assets',
    'mail-assets',
    true,
    2097152,  -- 2 MB max (dopo compressione WebP è molto meno)
    ARRAY['image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: ogni cliente può caricare solo nella propria cartella (client_id/)
CREATE POLICY "mail_assets_upload_own"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'mail-assets'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.clients WHERE user_id = auth.uid()
    )
);

-- Lettura pubblica (le immagini devono essere visibili nelle email inviate)
CREATE POLICY "mail_assets_public_read"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'mail-assets');

-- Eliminazione: solo il proprietario
CREATE POLICY "mail_assets_delete_own"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'mail-assets'
    AND (storage.foldername(name))[1] IN (
        SELECT id::text FROM public.clients WHERE user_id = auth.uid()
    )
);
