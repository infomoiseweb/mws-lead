-- Aggiunge i campi per la geolocalizzazione degli appuntamenti
-- (luogo/indirizzo + coordinate ottenute via geocoding), usati per
-- mostrare gli appuntamenti su mappa nella sezione "Fissa Appuntamento".

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS location_address TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS location_lat NUMERIC(9,6);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS location_lng NUMERIC(9,6);
