-- Aggiunge lo stato lead "Preventivo Accettato" e lo usa al posto di "Vinto"
-- quando un preventivo viene accettato nella sezione Preventivi.

-- 1. Aggiorna il vincolo di stato per includere "Preventivo Accettato"
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('Nuovo', 'Contattato', 'In Lavorazione', 'Perso', 'Vinto', 'Preventivo Inviato', 'Preventivo Accettato', 'Preventivo Rifiutato'));

-- 2. Ricrea la funzione impostando "Preventivo Accettato" invece di "Vinto"
DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.update_quote_status_and_handle_accepted(p_quote_id UUID, p_new_status VARCHAR)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.quotes SET status = p_new_status WHERE id = p_quote_id;

    IF p_new_status = 'accepted' THEN
        UPDATE public.leads SET status = 'Preventivo Accettato'
        WHERE id = (SELECT lead_id FROM public.quotes WHERE id = p_quote_id);
    END IF;
END;
$$;
