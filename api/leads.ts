import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import Busboy from 'busboy';

// Disabilita il body parser di Vercel per gestirlo manualmente
export const config = {
    api: { bodyParser: false },
};

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Parsa multipart/form-data e restituisce i campi come oggetto
function parseMultipart(req: VercelRequest): Promise<Record<string, string>> {
    return new Promise((resolve, reject) => {
        const fields: Record<string, string> = {};
        const bb = Busboy({ headers: req.headers });
        bb.on('field', (name, value) => { fields[name] = value; });
        bb.on('finish', () => resolve(fields));
        bb.on('error', reject);
        req.pipe(bb);
    });
}

// Parsa il body in base al Content-Type
async function parseBody(req: VercelRequest): Promise<Record<string, string>> {
    const contentType = req.headers['content-type'] || '';

    if (contentType.includes('multipart/form-data')) {
        return parseMultipart(req);
    }

    if (contentType.includes('application/x-www-form-urlencoded')) {
        return parseMultipart(req); // busboy gestisce anche urlencoded
    }

    // JSON — Vercel lo parsa già automaticamente quando bodyParser è abilitato
    // ma con bodyParser: false dobbiamo leggerlo manualmente
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end', () => {
            try { resolve(JSON.parse(raw || '{}')); }
            catch { reject(new Error('JSON non valido nel body')); }
        });
        req.on('error', reject);
    });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Usa POST.' });

    let body: Record<string, string>;
    try {
        body = await parseBody(req);
    } catch (e: any) {
        return res.status(400).json({ error: 'Impossibile leggere il body: ' + e.message });
    }

    // API token: prima dall'header, poi dal body
    const authHeader = req.headers.authorization;
    const tokenFromHeader = authHeader?.startsWith('Bearer ') ? authHeader.replace('Bearer ', '').trim() : null;
    const apiToken = tokenFromHeader || body.api_token || null;

    if (!apiToken) {
        return res.status(401).json({
            error: 'api_token mancante. Passalo come header "Authorization: Bearer <token>" o come campo "api_token".'
        });
    }

    const { data: clientRecord, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, name')
        .eq('api_token', apiToken)
        .single();

    if (clientError || !clientRecord) {
        return res.status(401).json({ error: 'api_token non valido o cliente non trovato.' });
    }

    // Rimuovi i campi riservati, tutto il resto va in lead.data
    const { service, api_token: _token, ...leadData } = body;

    if (!leadData || Object.keys(leadData).length === 0) {
        return res.status(400).json({ error: 'Nessun dato lead nel body.' });
    }

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
        message: `Lead salvata per "${clientRecord.name}".`
    });
}
