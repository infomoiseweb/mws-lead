-- Bucket per i PDF dei preventivi (pubblico in lettura, per condividere il link via WhatsApp/email)
insert into storage.buckets (id, name, public)
values ('quote-pdfs', 'quote-pdfs', true)
on conflict (id) do nothing;

-- Lettura pubblica (necessaria per aprire il link del PDF da WhatsApp/email)
create policy "Lettura pubblica PDF preventivi"
on storage.objects for select
using (bucket_id = 'quote-pdfs');

-- Ogni cliente può caricare/aggiornare SOLO i PDF dei propri preventivi
-- (file salvato come "<client_id>/<quote_id>.pdf")
create policy "Clienti caricano i propri PDF preventivi"
on storage.objects for insert
with check (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (
    select id::text from public.clients where user_id = auth.uid()
  )
);

create policy "Clienti aggiornano i propri PDF preventivi"
on storage.objects for update
using (
  bucket_id = 'quote-pdfs'
  and (storage.foldername(name))[1] = (
    select id::text from public.clients where user_id = auth.uid()
  )
);

-- L'admin può gestire i PDF di tutti i clienti
create policy "Admin gestisce tutti i PDF preventivi"
on storage.objects for all
using (
  bucket_id = 'quote-pdfs'
  and exists (select 1 from public.users where id = auth.uid() and role = 'admin')
);
