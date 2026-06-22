-- Sincronizzazione bidirezionale stato preventivo → stato lead.
-- Ogni cambio di stato del preventivo aggiorna lo stato della lead collegata.

DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, TEXT) CASCADE;

CREATE OR REPLACE FUNCTION public.update_quote_status_and_handle_accepted(p_quote_id UUID, p_new_status VARCHAR)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_lead_id UUID;
BEGIN
    UPDATE public.quotes SET status = p_new_status WHERE id = p_quote_id;

    SELECT lead_id INTO v_lead_id FROM public.quotes WHERE id = p_quote_id;

    IF v_lead_id IS NOT NULL THEN
        IF p_new_status = 'accepted' THEN
            UPDATE public.leads SET status = 'Preventivo Accettato' WHERE id = v_lead_id;
        ELSIF p_new_status = 'sent' THEN
            UPDATE public.leads SET status = 'Preventivo Inviato' WHERE id = v_lead_id;
        ELSIF p_new_status = 'rejected' THEN
            UPDATE public.leads SET status = 'Preventivo Rifiutato' WHERE id = v_lead_id;
        -- 'draft': nessun cambio automatico sullo stato lead
        END IF;
    END IF;
END;
$$;
