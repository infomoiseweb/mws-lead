-- Branding preventivi (logo per cliente, colori, font, dettagli azienda),
-- Termini e Condizioni preimpostati e per-preventivo, export PDF/email.

-- 1. Bucket per i loghi dei clienti (pubblico in lettura, un file per cliente)
insert into storage.buckets (id, name, public)
values ('client-logos', 'client-logos', true)
on conflict (id) do nothing;

-- 2. Lettura pubblica (necessaria per mostrare il logo nei preventivi PDF/email)
create policy "Lettura pubblica loghi clienti"
on storage.objects for select
using (bucket_id = 'client-logos');

-- 3. Ogni cliente può caricare/aggiornare SOLO il proprio logo
--    (file salvato come "<client_id>/logo.<ext>")
create policy "Clienti caricano il proprio logo"
on storage.objects for insert
with check (
  bucket_id = 'client-logos'
  and (storage.foldername(name))[1] = (
    select id::text from public.clients where user_id = auth.uid()
  )
);

create policy "Clienti aggiornano il proprio logo"
on storage.objects for update
using (
  bucket_id = 'client-logos'
  and (storage.foldername(name))[1] = (
    select id::text from public.clients where user_id = auth.uid()
  )
);

-- 4. L'admin può gestire i loghi di tutti i clienti
create policy "Admin gestisce tutti i loghi"
on storage.objects for all
using (
  bucket_id = 'client-logos'
  and exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);

-- 5. Colonna per i Termini e Condizioni del singolo preventivo
alter table public.quotes
  add column if not exists terms_and_conditions text;

-- 6. Aggiornare le RPC create_quote/update_quote per includere il nuovo campo
create or replace function public.create_quote(quote_data jsonb)
returns public.quotes
language plpgsql security definer as $$
declare
    new_quote public.quotes;
begin
    insert into public.quotes (
        client_id, lead_id, quote_number_display, quote_date, due_date,
        recipient_name, payment_type, notes, terms_and_conditions, taxable_amount, vat_amount,
        total_amount, status, items
    ) values (
        (quote_data->>'client_id')::uuid,
        (quote_data->>'lead_id')::uuid,
        quote_data->>'quote_number_display',
        (quote_data->>'quote_date')::date,
        (quote_data->>'due_date')::date,
        quote_data->>'recipient_name',
        quote_data->>'payment_type',
        quote_data->>'notes',
        quote_data->>'terms_and_conditions',
        (quote_data->>'taxable_amount')::numeric,
        (quote_data->>'vat_amount')::numeric,
        (quote_data->>'total_amount')::numeric,
        'draft',
        coalesce(quote_data->'items', '[]'::jsonb)
    )
    returning * into new_quote;
    return new_quote;
end;
$$;

create or replace function public.update_quote(p_quote_id uuid, quote_data jsonb)
returns public.quotes
language plpgsql security definer as $$
declare
    updated_quote public.quotes;
begin
    update public.quotes set
        quote_number_display = coalesce(quote_data->>'quote_number_display', quote_number_display),
        quote_date           = coalesce((quote_data->>'quote_date')::date, quote_date),
        due_date             = coalesce((quote_data->>'due_date')::date, due_date),
        recipient_name       = coalesce(quote_data->>'recipient_name', recipient_name),
        payment_type         = coalesce(quote_data->>'payment_type', payment_type),
        notes                = coalesce(quote_data->>'notes', notes),
        terms_and_conditions = coalesce(quote_data->>'terms_and_conditions', terms_and_conditions),
        taxable_amount       = coalesce((quote_data->>'taxable_amount')::numeric, taxable_amount),
        vat_amount           = coalesce((quote_data->>'vat_amount')::numeric, vat_amount),
        total_amount         = coalesce((quote_data->>'total_amount')::numeric, total_amount),
        items                = coalesce(quote_data->'items', items)
    where id = p_quote_id
    returning * into updated_quote;
    return updated_quote;
end;
$$;
