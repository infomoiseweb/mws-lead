import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import { renderMailTemplate, buildUnsubscribeUrl, findLeadEmail, findLeadName, verifyUnsubscribeToken } from './_lib/mailRender.js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const MAX_LEADS_PER_AUTOMATION = 50;

function htmlPage(message: string): string {
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Disiscrizione</title>
    <style>
        body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
        .card { max-width: 420px; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    </style>
</head>
<body>
    <div class="card"><p>${message}</p></div>
</body>
</html>`;
}

async function handleUnsubscribe(req: VercelRequest, res: VercelResponse) {
    const { token } = req.query;
    res.setHeader('Content-Type', 'text/html');

    if (typeof token !== 'string') return res.status(400).send(htmlPage('Link non valido.'));

    const decoded = verifyUnsubscribeToken(token);
    if (!decoded) return res.status(400).send(htmlPage('Link non valido o scaduto.'));

    const { error } = await supabaseAdmin
        .from('mail_unsubscribes')
        .upsert({ client_id: decoded.clientId, email: decoded.email.toLowerCase() }, { onConflict: 'client_id,email' });

    if (error) return res.status(500).send(htmlPage('Si è verificato un errore. Riprova più tardi.'));

    return res.status(200).send(htmlPage(`L'indirizzo ${decoded.email} è stato rimosso dalle comunicazioni di marketing.`));
}

async function handleAutomations(req: VercelRequest, res: VercelResponse) {
    const secret = process.env.AUTOMATION_CRON_SECRET;
    if (!secret) return res.status(500).json({ error: 'Server misconfigured' });
    if (req.headers['x-cron-secret'] !== secret) return res.status(401).json({ error: 'Unauthorized' });

    const { data: automations, error: automationsError } = await supabaseAdmin
        .from('mail_automations')
        .select('*')
        .eq('active', true);

    if (automationsError) return res.status(500).json({ error: automationsError.message });

    const baseUrl = `https://${req.headers.host}`;
    const results: any[] = [];

    for (const automation of automations || []) {
        const result = { automation_id: automation.id, name: automation.name, sent: 0, failed: 0, skipped: 0 };
        try {
            const { data: client } = await supabaseAdmin.from('clients').select('id, name, marketing_settings').eq('id', automation.client_id).single();
            if (!client) { results.push({ ...result, error: 'Cliente non trovato' }); continue; }

            const { data: mailDomain } = await supabaseAdmin.from('mail_domains').select('domain, status').eq('client_id', client.id).maybeSingle();
            if (!mailDomain || mailDomain.status !== 'verified') { results.push({ ...result, error: 'Dominio non verificato' }); continue; }

            if (!automation.template_id) { results.push({ ...result, error: 'Nessun template associato' }); continue; }

            const { data: template } = await supabaseAdmin.from('mail_templates').select('*').eq('id', automation.template_id).single();
            if (!template) { results.push({ ...result, error: 'Template non trovato' }); continue; }

            const cutoff = new Date(Date.now() - automation.delay_hours * 60 * 60 * 1000).toISOString();

            let leadsQuery = supabaseAdmin
                .from('leads')
                .select('id, data, status, created_at, updated_at')
                .eq('client_id', client.id)
                .limit(MAX_LEADS_PER_AUTOMATION * 4);

            if (automation.trigger_type === 'lead_created') {
                leadsQuery = leadsQuery.lte('created_at', cutoff);
            } else {
                leadsQuery = leadsQuery.eq('status', automation.trigger_status).lte('updated_at', cutoff);
            }

            const { data: leads } = await leadsQuery;
            if (!leads || leads.length === 0) { results.push(result); continue; }

            const { data: logRows } = await supabaseAdmin
                .from('mail_automation_log')
                .select('lead_id')
                .eq('automation_id', automation.id)
                .in('lead_id', leads.map(l => l.id));

            const alreadySent = new Set((logRows || []).map(r => r.lead_id));
            const pendingLeads = leads.filter(l => !alreadySent.has(l.id)).slice(0, MAX_LEADS_PER_AUTOMATION);
            if (pendingLeads.length === 0) { results.push(result); continue; }

            const { data: unsubscribed } = await supabaseAdmin.from('mail_unsubscribes').select('email').eq('client_id', client.id);
            const unsubscribedEmails = new Set((unsubscribed || []).map(u => u.email.toLowerCase()));

            const branding = client.marketing_settings?.branding || {};
            const senderName = client.marketing_settings?.sender_name || client.name;
            const fromAddress = `${senderName} <noreply@${mailDomain.domain}>`;

            for (const lead of pendingLeads) {
                const email = findLeadEmail(lead.data || {});
                if (!email || unsubscribedEmails.has(email.toLowerCase())) {
                    result.skipped++;
                    await supabaseAdmin.from('mail_automation_log').insert({ automation_id: automation.id, lead_id: lead.id });
                    continue;
                }

                const vars: Record<string, string> = {
                    nome: findLeadName(lead.data || {}),
                    logo_url: branding.logo_url || '',
                    brand_name: branding.brand_name || client.name,
                    primary_color: branding.primary_color || '#2563eb',
                    secondary_color: branding.secondary_color || '#1e293b',
                    footer_text: branding.footer_text || client.name,
                    unsubscribe_link: buildUnsubscribeUrl(baseUrl, email, client.id),
                };

                const { error: sendError } = await resend.emails.send({
                    from: fromAddress,
                    to: [email],
                    subject: renderMailTemplate(template.subject_template, vars),
                    html: renderMailTemplate(template.body_html, vars),
                });

                if (sendError) result.failed++;
                else result.sent++;

                await supabaseAdmin.from('mail_automation_log').insert({ automation_id: automation.id, lead_id: lead.id });
            }

            results.push(result);
        } catch (err: any) {
            results.push({ ...result, error: err.message || 'Errore sconosciuto' });
        }
    }

    return res.status(200).json({ processed: results.length, results });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const action = req.query.action as string;

    if (action === 'unsubscribe') return handleUnsubscribe(req, res);
    if (action === 'automations') return handleAutomations(req, res);

    return res.status(400).json({ error: 'action non valida. Usa ?action=unsubscribe o ?action=automations' });
}
