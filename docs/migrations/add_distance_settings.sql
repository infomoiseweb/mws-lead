-- Aggiunge la colonna distance_settings su clients per il calcolo automatico
-- della distanza tra la sede del cliente e il punto di intervento della lead.

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS distance_settings jsonb DEFAULT NULL;
