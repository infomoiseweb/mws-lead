ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS google_access_token  text,
  ADD COLUMN IF NOT EXISTS google_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_token_expiry  bigint,
  ADD COLUMN IF NOT EXISTS google_calendar_id   text DEFAULT 'primary',
  ADD COLUMN IF NOT EXISTS google_calendar_enabled boolean NOT NULL DEFAULT false;

-- Salva l'event_id di Google Calendar su ogni appuntamento
-- così possiamo aggiornarlo/eliminarlo in seguito
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS google_event_id text;
