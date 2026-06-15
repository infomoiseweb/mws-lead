-- Mail Marketing: domini email per cliente (Resend), template, campagne,
-- automazioni basate su tempo/stato lead, e disiscrizioni.

-- =========================================================
-- 0. Colonna updated_at su leads (serve per le automazioni
--    di tipo "lead_status_changed", per sapere da quanto
--    tempo una lead è in un certo stato).
-- =========================================================
alter table public.leads
    add column if not exists updated_at timestamptz not null default now();

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
    new.updated_at = now();
    return new;
end;
$$;

drop trigger if exists leads_set_updated_at on public.leads;
create trigger leads_set_updated_at
    before update on public.leads
    for each row execute function public.set_updated_at();

-- =========================================================
-- 1. Branding / impostazioni mail marketing per cliente
-- =========================================================
alter table public.clients
    add column if not exists marketing_settings jsonb;

-- =========================================================
-- 2. Domini email collegati a Resend (per cliente)
-- =========================================================
create table if not exists public.mail_domains (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    domain text not null,
    resend_domain_id text,
    status text not null default 'pending' check (status in ('pending', 'verified', 'failed')),
    dns_records jsonb,
    created_at timestamptz not null default now()
);

create unique index if not exists mail_domains_client_id_idx on public.mail_domains(client_id);

alter table public.mail_domains enable row level security;

create policy "Client: gestisce il proprio dominio mail"
on public.mail_domains for all
using (client_id in (select id from public.clients where user_id = auth.uid()))
with check (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "Admin: gestisce tutti i domini mail"
on public.mail_domains for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- =========================================================
-- 3. Template email
-- =========================================================
create table if not exists public.mail_templates (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    name text not null,
    layout text not null default 'simple' check (layout in ('simple', 'image_header', 'newsletter')),
    subject_template text not null default '',
    body_html text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

drop trigger if exists mail_templates_set_updated_at on public.mail_templates;
create trigger mail_templates_set_updated_at
    before update on public.mail_templates
    for each row execute function public.set_updated_at();

alter table public.mail_templates enable row level security;

create policy "Client: gestisce i propri template mail"
on public.mail_templates for all
using (client_id in (select id from public.clients where user_id = auth.uid()))
with check (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "Admin: gestisce tutti i template mail"
on public.mail_templates for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- =========================================================
-- 4. Campagne email
-- =========================================================
create table if not exists public.mail_campaigns (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    template_id uuid references public.mail_templates(id) on delete set null,
    name text not null,
    subject text not null default '',
    status text not null default 'draft' check (status in ('draft', 'scheduled', 'sending', 'sent', 'failed')),
    filters jsonb not null default '{}'::jsonb,
    scheduled_at timestamptz,
    sent_at timestamptz,
    created_at timestamptz not null default now()
);

alter table public.mail_campaigns enable row level security;

create policy "Client: gestisce le proprie campagne mail"
on public.mail_campaigns for all
using (client_id in (select id from public.clients where user_id = auth.uid()))
with check (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "Admin: gestisce tutte le campagne mail"
on public.mail_campaigns for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- =========================================================
-- 5. Destinatari campagna (esito invio per singola lead)
-- =========================================================
create table if not exists public.mail_campaign_recipients (
    id uuid primary key default gen_random_uuid(),
    campaign_id uuid not null references public.mail_campaigns(id) on delete cascade,
    lead_id uuid references public.leads(id) on delete set null,
    email text not null,
    status text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'bounced')),
    sent_at timestamptz,
    error text,
    created_at timestamptz not null default now()
);

create index if not exists mail_campaign_recipients_campaign_id_idx on public.mail_campaign_recipients(campaign_id, status);

alter table public.mail_campaign_recipients enable row level security;

create policy "Client: legge i destinatari delle proprie campagne"
on public.mail_campaign_recipients for select
using (campaign_id in (
    select id from public.mail_campaigns
    where client_id in (select id from public.clients where user_id = auth.uid())
));

create policy "Admin: gestisce tutti i destinatari"
on public.mail_campaign_recipients for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Nessuna policy insert/update per i client: le righe vengono scritte
-- esclusivamente da /api/send-mail-campaign e /api/process-mail-automations
-- tramite service role (bypassano RLS).

-- =========================================================
-- 6. Automazioni
-- =========================================================
create table if not exists public.mail_automations (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    name text not null,
    trigger_type text not null check (trigger_type in ('lead_created', 'lead_status_changed')),
    trigger_status text,
    delay_hours integer not null default 0,
    template_id uuid references public.mail_templates(id) on delete set null,
    active boolean not null default true,
    created_at timestamptz not null default now()
);

alter table public.mail_automations enable row level security;

create policy "Client: gestisce le proprie automazioni mail"
on public.mail_automations for all
using (client_id in (select id from public.clients where user_id = auth.uid()))
with check (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "Admin: gestisce tutte le automazioni mail"
on public.mail_automations for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- =========================================================
-- 7. Log invii automazioni (anti-duplicati)
-- =========================================================
create table if not exists public.mail_automation_log (
    id uuid primary key default gen_random_uuid(),
    automation_id uuid not null references public.mail_automations(id) on delete cascade,
    lead_id uuid not null references public.leads(id) on delete cascade,
    sent_at timestamptz not null default now()
);

create unique index if not exists mail_automation_log_unique_idx on public.mail_automation_log(automation_id, lead_id);

alter table public.mail_automation_log enable row level security;

create policy "Client: legge il log delle proprie automazioni"
on public.mail_automation_log for select
using (automation_id in (
    select id from public.mail_automations
    where client_id in (select id from public.clients where user_id = auth.uid())
));

create policy "Admin: gestisce tutto il log automazioni"
on public.mail_automation_log for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Scrittura riservata a /api/process-mail-automations (service role).

-- =========================================================
-- 8. Disiscrizioni
-- =========================================================
create table if not exists public.mail_unsubscribes (
    id uuid primary key default gen_random_uuid(),
    client_id uuid not null references public.clients(id) on delete cascade,
    email text not null,
    unsubscribed_at timestamptz not null default now()
);

create unique index if not exists mail_unsubscribes_unique_idx on public.mail_unsubscribes(client_id, email);

alter table public.mail_unsubscribes enable row level security;

create policy "Client: legge le proprie disiscrizioni"
on public.mail_unsubscribes for select
using (client_id in (select id from public.clients where user_id = auth.uid()));

create policy "Admin: gestisce tutte le disiscrizioni"
on public.mail_unsubscribes for all
using (exists (select 1 from public.users where id = auth.uid() and role = 'admin'))
with check (exists (select 1 from public.users where id = auth.uid() and role = 'admin'));

-- Scrittura riservata a /api/mail-unsubscribe (service role, pubblico no-auth).
