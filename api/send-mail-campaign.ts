import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { executeSendCampaign } from './_lib/sendCampaign.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Autenticazione: JWT utente OPPURE CRON_SECRET di Vercel
    const cronSecret = process.env.CRON_SECRET || process.env.AUTOMATION_CRON_SECRET;
    const authHeader = req.headers.authorization || '';
    const isCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

    if (!isCron) {
        const jwt = authHeader.replace('Bearer ', '');
        if (!jwt) return res.status(401).json({ error: 'Unauthorized' });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
        if (authError || !user) return res.status(401).json({ error: 'Token non valido o scaduto' });

        // Verifica che l'utente sia il proprietario o admin
        const { campaignId } = req.body || {};
        if (!campaignId) return res.status(400).json({ error: 'campaignId richiesto' });

        const { data: campaign } = await supabaseAdmin
            .from('mail_campaigns').select('client_id').eq('id', campaignId).single();
        if (!campaign) return res.status(404).json({ error: 'Campagna non trovata' });

        const { data: client } = await supabaseAdmin
            .from('clients').select('user_id').eq('id', campaign.client_id).single();
        const { data: requester } = await supabaseAdmin
            .from('users').select('role').eq('id', user.id).single();

        if (client?.user_id !== user.id && requester?.role !== 'admin') {
            return res.status(403).json({ error: 'Non autorizzato' });
        }
    }

    const { campaignId } = req.body || {};
    if (!campaignId) return res.status(400).json({ error: 'campaignId richiesto' });

    const baseUrl = `https://${req.headers.host}`;
    const result = await executeSendCampaign(campaignId, supabaseAdmin, resend, baseUrl);

    if (result.error && result.sent === 0) {
        return res.status(400).json({ error: result.error });
    }

    const { data: updatedCampaign } = await supabaseAdmin
        .from('mail_campaigns').select('*').eq('id', campaignId).single();

    return res.status(200).json({ campaign: updatedCampaign, sent: result.sent, failed: result.failed });
}
