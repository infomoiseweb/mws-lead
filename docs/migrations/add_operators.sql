-- Migration: operatori per clienti con più persone
CREATE TABLE IF NOT EXISTS public.operators (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL,
    color text NOT NULL DEFAULT '#6366f1',
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.lead_status_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id uuid NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    client_id uuid NOT NULL,
    operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
    operator_name text,
    old_status text,
    new_status text NOT NULL,
    note text,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS operators_enabled boolean NOT NULL DEFAULT false;

-- RLS
ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lead_status_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operators_client_access" ON public.operators
    FOR ALL USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );

CREATE POLICY "logs_client_access" ON public.lead_status_logs
    FOR ALL USING (
        client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid())
    );
