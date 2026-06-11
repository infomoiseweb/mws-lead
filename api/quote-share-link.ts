import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

function generateCode(length = 8): string {
    let code = '';
    for (let i = 0; i < length; i++) {
        code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
    }
    return code;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
        return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    const { quoteId, clientId } = req.body;
    if (!quoteId || !clientId) {
        return res.status(400).json({ error: 'quoteId e clientId sono obbligatori' });
    }

    // Verifica che il preventivo appartenga al cliente indicato e che l'utente
    // possa accedervi (proprietario del cliente oppure admin).
    const { data: quote, error: quoteError } = await supabaseAdmin
        .from('quotes')
        .select('id, client_id')
        .eq('id', quoteId)
        .eq('client_id', clientId)
        .single();

    if (quoteError || !quote) {
        return res.status(404).json({ error: 'Preventivo non trovato' });
    }

    const { data: userRow } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    const { data: clientRow } = await supabaseAdmin
        .from('clients')
        .select('id, user_id')
        .eq('id', clientId)
        .single();

    const isOwner = clientRow?.user_id === user.id;
    const isAdmin = userRow?.role === 'admin';
    if (!isOwner && !isAdmin) {
        return res.status(403).json({ error: 'Non autorizzato' });
    }

    // Riutilizza il codice esistente se già generato per questo preventivo.
    const { data: existing } = await supabaseAdmin
        .from('quote_share_links')
        .select('code')
        .eq('quote_id', quoteId)
        .maybeSingle();

    if (existing?.code) {
        return res.status(200).json({ code: existing.code });
    }

    // Genera un codice univoco con qualche tentativo in caso di collisione.
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = generateCode();
        const { error: insertError } = await supabaseAdmin
            .from('quote_share_links')
            .insert({ code, client_id: clientId, quote_id: quoteId });

        if (!insertError) {
            return res.status(200).json({ code });
        }
        // 23505 = unique_violation: riprova con un nuovo codice
        if (insertError.code !== '23505') {
            return res.status(500).json({ error: insertError.message });
        }
    }

    return res.status(500).json({ error: 'Impossibile generare un link univoco, riprova.' });
}
