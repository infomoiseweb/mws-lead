-- Mail Flows: flussi di automazione email visuali
-- Eseguire nel SQL Editor di Supabase

CREATE TABLE IF NOT EXISTS public.mail_flows (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name text NOT NULL DEFAULT 'Nuovo flusso',
    active boolean NOT NULL DEFAULT false,
    flow_data jsonb NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- RLS
ALTER TABLE public.mail_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clients_own_flows" ON public.mail_flows
    FOR ALL USING (
        client_id IN (
            SELECT id FROM public.clients WHERE user_id = auth.uid()
        )
    );

-- Log esecuzione (evita di inviare la stessa email due volte)
CREATE TABLE IF NOT EXISTS public.mail_flow_log (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    flow_id uuid NOT NULL REFERENCES public.mail_flows(id) ON DELETE CASCADE,
    lead_id uuid NOT NULL,
    node_id text NOT NULL,
    executed_at timestamptz DEFAULT now(),
    UNIQUE(flow_id, lead_id, node_id)
);

ALTER TABLE public.mail_flow_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "flow_log_admin_only" ON public.mail_flow_log
    FOR ALL USING (false); -- solo service role può leggere/scrivere
