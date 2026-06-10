-- Aggiunge la possibilità di includere nel preventivo altri dati arrivati con la lead
-- (oltre al "Destinatario"), salvati come coppie etichetta/valore.

alter table public.quotes
  add column if not exists extra_fields jsonb default '{}'::jsonb;

create or replace function public.create_quote(quote_data jsonb)
returns public.quotes
language plpgsql security definer as $$
declare
    new_quote public.quotes;
begin
    insert into public.quotes (
        client_id, lead_id, quote_number_display, quote_date, due_date,
        recipient_name, payment_type, notes, terms_and_conditions, extra_fields, taxable_amount, vat_amount,
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
        coalesce(quote_data->'extra_fields', '{}'::jsonb),
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
        extra_fields         = coalesce(quote_data->'extra_fields', extra_fields),
        taxable_amount       = coalesce((quote_data->>'taxable_amount')::numeric, taxable_amount),
        vat_amount           = coalesce((quote_data->>'vat_amount')::numeric, vat_amount),
        total_amount         = coalesce((quote_data->>'total_amount')::numeric, total_amount),
        items                = coalesce(quote_data->'items', items)
    where id = p_quote_id
    returning * into updated_quote;
    return updated_quote;
end;
$$;
