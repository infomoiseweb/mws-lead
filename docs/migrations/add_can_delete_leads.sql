-- Aggiunge il permesso per consentire (o meno) al cliente di eliminare le proprie lead.
-- Default FALSE: i clienti esistenti non possono eliminare lead finché l'admin non lo abilita esplicitamente.

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS can_delete_leads boolean NOT NULL DEFAULT false;
