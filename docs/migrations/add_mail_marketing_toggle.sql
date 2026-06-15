-- Permette all'admin di decidere a quali clienti è abilitata la sezione "Mail Marketing".
alter table public.clients
    add column if not exists mail_marketing_enabled boolean not null default false;
