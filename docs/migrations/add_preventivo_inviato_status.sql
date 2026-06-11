-- Aggiunge il nuovo stato lead "Preventivo Inviato" e risolve l'ambiguità
-- della funzione update_quote_status_and_handle_accepted (esistono due
-- overload, uno con parametro VARCHAR e uno con TEXT, che PostgREST non
-- riesce a distinguere).

-- 1. Estendi il vincolo di stato sulla tabella leads
ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_status_check;
ALTER TABLE public.leads ADD CONSTRAINT leads_status_check
    CHECK (status IN ('Nuovo', 'Contattato', 'In Lavorazione', 'Perso', 'Vinto', 'Preventivo Inviato'));

-- 2. Rimuovi tutti gli overload esistenti della funzione (VARCHAR e TEXT)
DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, TEXT) CASCADE;

-- 3. Ricrea un'unica versione della funzione
CREATE OR REPLACE FUNCTION public.update_quote_status_and_handle_accepted(p_quote_id UUID, p_new_status VARCHAR)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.quotes SET status = p_new_status WHERE id = p_quote_id;

    IF p_new_status = 'accepted' THEN
        UPDATE public.leads SET status = 'Vinto'
        WHERE id = (SELECT lead_id FROM public.quotes WHERE id = p_quote_id);
    END IF;
END;
$$;
