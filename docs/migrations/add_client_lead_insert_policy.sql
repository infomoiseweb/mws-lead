-- Permette ai clienti di inserire manualmente nuove lead per sé stessi
-- (finora solo l'admin poteva inserire righe in "leads", per questo
-- "Aggiungi Lead manualmente" dava errore di Row Level Security).

create policy "Client: inserisce le proprie lead"
on public.leads for insert
with check (client_id in (select id from public.clients where user_id = auth.uid()));
