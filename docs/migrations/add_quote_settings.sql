-- Aggiunge le impostazioni preventivi (numerazione personalizzata + preset di prezzo per servizio)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS quote_settings JSONB NOT NULL DEFAULT '{}'::jsonb;
