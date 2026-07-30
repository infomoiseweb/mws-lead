-- Tracking aperture e click per mail marketing
ALTER TABLE public.mail_campaign_recipients
    ADD COLUMN IF NOT EXISTS opened_at timestamptz,
    ADD COLUMN IF NOT EXISTS clicked_at timestamptz,
    ADD COLUMN IF NOT EXISTS lead_email text,
    ADD COLUMN IF NOT EXISTS lead_name text;
