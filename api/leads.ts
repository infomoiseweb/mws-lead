import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // CORS — permette chiamate da qualsiasi dominio esterno
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(204).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed. Usa POST.' });
    }

    // Autenticazione tramite api_token del cliente
    // Accettato sia come header "Authorization: Bearer <token>"
    // sia come campo nel body "api_token": "..."
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
    const tokenFromBody = req.body?.api_token ?? null;
    const apiToken = tokenFromHeader || tokenFromBody;

    if (!apiToken) {
        return res.status(401).json({
            error: 'api_token mancante. Passalo come header "Authorization: Bearer <token>" o nel body come campo "api_token".'
        });
    }

    // Cerca il cliente con questo token
    const { data: clientRecord, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, name')
        .eq('api_token', apiToken)
        .single();

    if (clientError || !clientRecord) {
        return res.status(401).json({ error: 'api_token non valido o cliente non trovato.' });
    }

    // Estrai i dati della lead dal body
    // "service" e "api_token" sono campi riservati, tutto il resto va in lead.data
    const { service, api_token: _token, ...leadData } = req.body;

    if (!leadData || Object.keys(leadData).length === 0) {
        return res.status(400).json({ error: 'Nessun dato lead nel body. Includi almeno un campo (es. nome, telefono).' });
    }

    // Inserisci la lead
    const { data: newLead, error: insertError } = await supabaseAdmin
        .from('leads')
        .insert({
            client_id: clientRecord.id,
            data: leadData,
            service: service || null,
            status: 'Nuovo',
        })
        .select()
        .single();

    if (insertError) {
        return res.status(500).json({ error: insertError.message });
    }

    return res.status(201).json({
        success: true,
        lead_id: newLead.id,
        message: `Lead salvata correttamente per il cliente "${clientRecord.name}".`
    });
}
