import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { renderMailTemplate, buildUnsubscribeUrl, findLeadEmail, findLeadName } from './_lib/mailRender.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BATCH_SIZE = 90;

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

    const { campaignId } = req.body || {};
    if (!campaignId) return res.status(400).json({ error: 'campaignId richiesto' });

    const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('mail_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

    if (campaignError || !campaign) return res.status(404).json({ error: 'Campagna non trovata' });

    const { data: client, error: clientError } = await supabaseAdmin
        .from('clients')
        .select('id, name, user_id, marketing_settings')
        .eq('id', campaign.client_id)
        .single();

    if (clientError || !client) return res.status(404).json({ error: 'Cliente non trovato' });

    const { data: requester } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single();

    const isOwner = client.user_id === user.id;
    const isAdmin = requester?.role === 'admin';
    if (!isOwner && !isAdmin) return res.status(403).json({ error: 'Non autorizzato' });

    if (!campaign.template_id) return res.status(400).json({ error: 'La campagna non ha un template associato' });

    const { data: template, error: templateError } = await supabaseAdmin
        .from('mail_templates')
        .select('*')
        .eq('id', campaign.template_id)
        .single();

    if (templateError || !template) return res.status(404).json({ error: 'Template non trovato' });

    const { data: mailDomain } = await supabaseAdmin
        .from('mail_domains')
        .select('domain, status')
        .eq('client_id', client.id)
        .maybeSingle();

    if (!mailDomain || mailDomain.status !== 'verified') {
        return res.status(400).json({ error: 'Devi prima collegare e verificare un dominio email nella sezione "Mail Marketing".' });
    }

    // Carica le lead del cliente applicando i filtri della campagna
    const filters = campaign.filters || {};
    let leadsQuery = supabaseAdmin.from('leads').select('id, data, status, service, created_at').eq('client_id', client.id);

    if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
        leadsQuery = leadsQuery.in('status', filters.statuses);
    }
    if (Array.isArray(filters.services) && filters.services.length > 0) {
        leadsQuery = leadsQuery.in('service', filters.services);
    }
    if (filters.created_after) {
        leadsQuery = leadsQuery.gte('created_at', filters.created_after);
    }
    if (filters.created_before) {
        leadsQuery = leadsQuery.lte('created_at', filters.created_before);
    }

    const { data: leads, error: leadsError } = await leadsQuery;
    if (leadsError) return res.status(500).json({ error: leadsError.message });

    const { data: unsubscribed } = await supabaseAdmin
        .from('mail_unsubscribes')
        .select('email')
        .eq('client_id', client.id);

    const unsubscribedEmails = new Set((unsubscribed || []).map(u => u.email.toLowerCase()));

    await supabaseAdmin.from('mail_campaigns').update({ status: 'sending' }).eq('id', campaignId);

    const branding = client.marketing_settings?.branding || {};
    const senderName = client.marketing_settings?.sender_name || client.name;
    const fromAddress = `${senderName} <noreply@${mailDomain.domain}>`;
    const baseUrl = `https://${req.headers.host}`;

    type Recipient = { lead_id: string | null; email: string; html: string; subject: string };
    const recipients: Recipient[] = [];

    for (const lead of leads || []) {
        const email = findLeadEmail(lead.data || {});
        if (!email || unsubscribedEmails.has(email.toLowerCase())) continue;

        const vars: Record<string, string> = {
            nome: findLeadName(lead.data || {}),
            logo_url: branding.logo_url || '',
            brand_name: branding.brand_name || client.name,
            primary_color: branding.primary_color || '#2563eb',
            secondary_color: branding.secondary_color || '#1e293b',
            footer_text: branding.footer_text || client.name,
            unsubscribe_link: buildUnsubscribeUrl(baseUrl, email, client.id),
        };

        recipients.push({
            lead_id: lead.id,
            email,
            html: renderMailTemplate(template.body_html, vars),
            subject: renderMailTemplate(campaign.subject || template.subject_template, vars),
        });
    }

    if (recipients.length === 0) {
        await supabaseAdmin.from('mail_campaigns').update({ status: 'failed' }).eq('id', campaignId);
        return res.status(400).json({ error: 'Nessuna lead con email valida corrisponde ai filtri selezionati.' });
    }

    const recipientRows: any[] = [];

    for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
        const chunk = recipients.slice(i, i + BATCH_SIZE);
        const { data: batchResult, error: batchError } = await resend.batch.send(
            chunk.map(r => ({ from: fromAddress, to: [r.email], subject: r.subject, html: r.html }))
        );

        chunk.forEach((r, idx) => {
            const sendError = batchError || !batchResult?.data?.[idx];
            recipientRows.push({
                campaign_id: campaignId,
                lead_id: r.lead_id,
                email: r.email,
                status: sendError ? 'failed' : 'sent',
                sent_at: sendError ? null : new Date().toISOString(),
                error: sendError ? (batchError?.message || 'Invio non riuscito') : null,
            });
        });
    }

    await supabaseAdmin.from('mail_campaign_recipients').insert(recipientRows);

    const allFailed = recipientRows.every(r => r.status === 'failed');
    const finalStatus = allFailed ? 'failed' : 'sent';

    const { data: updatedCampaign, error: updateError } = await supabaseAdmin
        .from('mail_campaigns')
        .update({ status: finalStatus, sent_at: new Date().toISOString() })
        .eq('id', campaignId)
        .select()
        .single();

    if (updateError) return res.status(500).json({ error: updateError.message });
    return res.status(200).json({ campaign: updatedCampaign, sent: recipientRows.filter(r => r.status === 'sent').length, failed: recipientRows.filter(r => r.status === 'failed').length });
}
