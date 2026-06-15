import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
        return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id')
        .eq('user_id', user.id)
        .single();

    if (clientError || !client) {
        return res.status(404).json({ error: 'Cliente non trovato per questo utente' });
    }

    const clientId = client.id as string;

    if (req.method === 'GET') {
        const { data, error } = await supabaseAdmin
            .from('mail_domains')
            .select('*')
            .eq('client_id', clientId)
            .maybeSingle();

        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ domain: data });
    }

    if (req.method === 'POST') {
        const { domain, action, domainId } = req.body || {};

        if (action === 'verify') {
            if (!domainId) return res.status(400).json({ error: 'domainId richiesto' });

            const { data: existing, error: fetchError } = await supabaseAdmin
                .from('mail_domains')
                .select('*')
                .eq('id', domainId)
                .eq('client_id', clientId)
                .single();

            if (fetchError || !existing) return res.status(404).json({ error: 'Dominio non trovato' });
            if (!existing.resend_domain_id) return res.status(400).json({ error: 'Dominio non collegato a Resend' });

            await resend.domains.verify(existing.resend_domain_id);
            const { data: refreshed, error: getError } = await resend.domains.get(existing.resend_domain_id);
            if (getError || !refreshed) return res.status(500).json({ error: getError?.message || 'Errore durante la verifica del dominio' });

            const status = refreshed.status === 'verified' ? 'verified' : (refreshed.status === 'failed' ? 'failed' : 'pending');

            const { data: updated, error: updateError } = await supabaseAdmin
                .from('mail_domains')
                .update({ status, dns_records: refreshed.records })
                .eq('id', domainId)
                .select()
                .single();

            if (updateError) return res.status(500).json({ error: updateError.message });
            return res.status(200).json({ domain: updated });
        }

        if (!domain || typeof domain !== 'string') {
            return res.status(400).json({ error: 'Il campo domain è obbligatorio' });
        }

        const { data: existing } = await supabaseAdmin
            .from('mail_domains')
            .select('id')
            .eq('client_id', clientId)
            .maybeSingle();

        if (existing) {
            return res.status(409).json({ error: 'Hai già un dominio collegato. Rimuovilo prima di aggiungerne un altro.' });
        }

        const { data: created, error: createError } = await resend.domains.create({ name: domain });
        if (createError || !created) return res.status(500).json({ error: createError?.message || 'Errore durante la creazione del dominio su Resend' });

        const status = created.status === 'verified' ? 'verified' : (created.status === 'failed' ? 'failed' : 'pending');

        const { data: inserted, error: insertError } = await supabaseAdmin
            .from('mail_domains')
            .insert({
                client_id: clientId,
                domain,
                resend_domain_id: created.id,
                status,
                dns_records: created.records,
            })
            .select()
            .single();

        if (insertError) return res.status(500).json({ error: insertError.message });
        return res.status(200).json({ domain: inserted });
    }

    if (req.method === 'DELETE') {
        const { domainId } = req.body || {};
        if (!domainId) return res.status(400).json({ error: 'domainId richiesto' });

        const { data: existing, error: fetchError } = await supabaseAdmin
            .from('mail_domains')
            .select('*')
            .eq('id', domainId)
            .eq('client_id', clientId)
            .single();

        if (fetchError || !existing) return res.status(404).json({ error: 'Dominio non trovato' });

        if (existing.resend_domain_id) {
            await resend.domains.remove(existing.resend_domain_id);
        }

        const { error: deleteError } = await supabaseAdmin
            .from('mail_domains')
            .delete()
            .eq('id', domainId);

        if (deleteError) return res.status(500).json({ error: deleteError.message });
        return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
