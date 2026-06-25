-- Permesso modifica lead per cliente
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS can_edit_leads boolean NOT NULL DEFAULT false;

-- Flag lead inserita manualmente dall'utente
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false;
