-- Tabella per i link corti dei PDF dei preventivi (es. https://tuodominio.it/api/q/Ab3dE9fG)
-- al posto del lungo URL di Supabase Storage, che espone il nome del progetto/database.
create table if not exists public.quote_share_links (
    code text primary key,
    client_id uuid not null references public.clients(id) on delete cascade,
    quote_id uuid not null references public.quotes(id) on delete cascade,
    created_at timestamptz not null default now()
);

create unique index if not exists quote_share_links_quote_id_idx on public.quote_share_links(quote_id);

alter table public.quote_share_links enable row level security;

-- Nessuna policy pubblica: la creazione e la lettura avvengono solo tramite
-- le funzioni serverless (/api/quote-share-link e /api/q/[code]) che usano
-- la service role key e bypassano RLS.
