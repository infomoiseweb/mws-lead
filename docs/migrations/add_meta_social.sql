-- Migration: add Meta social columns to clients
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS meta_enabled boolean NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS meta_access_token text,
    ADD COLUMN IF NOT EXISTS meta_token_expiry bigint,
    ADD COLUMN IF NOT EXISTS meta_pages jsonb DEFAULT '[]'::jsonb;
