import { Resend } from 'resend';
import { SupabaseClient } from '@supabase/supabase-js';
import { renderMailTemplate, buildUnsubscribeUrl, findLeadEmail, findLeadName, injectTracking } from './mailRender.js';

const BATCH_SIZE = 90;

export async function executeSendCampaign(
    campaignId: string,
    supabaseAdmin: SupabaseClient,
    resend: Resend,
    baseUrl: string
): Promise<{ sent: number; failed: number; error?: string }> {

    const { data: campaign, error: campaignError } = await supabaseAdmin
        .from('mail_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

    if (campaignError || !campaign) return { sent: 0, failed: 0, error: 'Campagna non trovata' };
    if (!campaign.template_id) return { sent: 0, failed: 0, error: 'Nessun template associato' };

    const { data: client } = await supabaseAdmin
        .from('clients')
        .select('id, name, user_id, marketing_settings')
        .eq('id', campaign.client_id)
        .single();

    if (!client) return { sent: 0, failed: 0, error: 'Cliente non trovato' };

    const { data: template } = await supabaseAdmin
        .from('mail_templates')
        .select('*')
        .eq('id', campaign.template_id)
        .single();

    if (!template) return { sent: 0, failed: 0, error: 'Template non trovato' };

    const { data: mailDomain } = await supabaseAdmin
        .from('mail_domains')
        .select('domain, status')
        .eq('client_id', client.id)
        .maybeSingle();

    if (!mailDomain || mailDomain.status !== 'verified') {
        return { sent: 0, failed: 0, error: 'Dominio non verificato' };
    }

    // Carica le lead applicando i filtri
    const filters = campaign.filters || {};
    let leadsQuery = supabaseAdmin
        .from('leads')
        .select('id, data, status, service, created_at')
        .eq('client_id', client.id);

    if (Array.isArray(filters.lead_ids) && filters.lead_ids.length > 0) {
        leadsQuery = leadsQuery.in('id', filters.lead_ids);
    } else {
        if (Array.isArray(filters.statuses) && filters.statuses.length > 0)
            leadsQuery = leadsQuery.in('status', filters.statuses);
        if (Array.isArray(filters.services) && filters.services.length > 0)
            leadsQuery = leadsQuery.in('service', filters.services);
        if (filters.created_after) leadsQuery = leadsQuery.gte('created_at', filters.created_after);
        if (filters.created_before) leadsQuery = leadsQuery.lte('created_at', filters.created_before);
    }

    const { data: leads } = await leadsQuery;

    const { data: unsubscribed } = await supabaseAdmin
        .from('mail_unsubscribes')
        .select('email')
        .eq('client_id', client.id);

    const unsubscribedEmails = new Set((unsubscribed || []).map((u: any) => u.email.toLowerCase()));

    await supabaseAdmin.from('mail_campaigns').update({ status: 'sending' }).eq('id', campaignId);

    const branding = client.marketing_settings?.branding || {};
    const senderName = client.marketing_settings?.sender_name || client.name;
    const fromAddress = `${senderName} <noreply@${mailDomain.domain}>`;

    // Pre-inserisce i recipient
    const pendingRows: any[] = [];
    for (const lead of leads || []) {
        const email = findLeadEmail(lead.data || {});
        if (!email || unsubscribedEmails.has(email.toLowerCase())) continue;
        pendingRows.push({
            campaign_id: campaignId,
            lead_id: lead.id,
            email,
            lead_name: findLeadName(lead.data || {}),
            status: 'pending',
        });
    }

    if (pendingRows.length === 0) {
        await supabaseAdmin.from('mail_campaigns').update({ status: 'failed' }).eq('id', campaignId);
        return { sent: 0, failed: 0, error: 'Nessuna lead con email valida' };
    }

    const { data: insertedRecipients, error: insertError } = await supabaseAdmin
        .from('mail_campaign_recipients')
        .insert(pendingRows)
        .select('id, email, lead_id, lead_name');

    if (insertError || !insertedRecipients) {
        return { sent: 0, failed: 0, error: insertError?.message || 'Errore inserimento destinatari' };
    }

    let sent = 0;
    let failed = 0;

    for (let i = 0; i < insertedRecipients.length; i += BATCH_SIZE) {
        const chunk = insertedRecipients.slice(i, i + BATCH_SIZE);
        const { data: batchResult, error: batchError } = await resend.batch.send(
            chunk.map((r: any) => {
                const vars: Record<string, string> = {
                    nome: r.lead_name || '',
                    logo_url: branding.logo_url || '',
                    brand_name: branding.brand_name || client.name,
                    primary_color: branding.primary_color || '#2563eb',
                    secondary_color: branding.secondary_color || '#1e293b',
                    footer_text: branding.footer_text || client.name,
                    unsubscribe_link: buildUnsubscribeUrl(baseUrl, r.email, client.id),
                };
                const rawHtml = renderMailTemplate(template.body_html, vars);
                const trackedHtml = injectTracking(rawHtml, baseUrl, r.id);
                const subject = renderMailTemplate(campaign.subject || template.subject_template, vars);
                return { from: fromAddress, to: [r.email], subject, html: trackedHtml };
            })
        );

        for (let j = 0; j < chunk.length; j++) {
            const r = chunk[j];
            const ok = !batchError && batchResult?.data?.[j];
            await supabaseAdmin.from('mail_campaign_recipients').update({
                status: ok ? 'sent' : 'failed',
                sent_at: ok ? new Date().toISOString() : null,
                error: ok ? null : (batchError?.message || 'Invio non riuscito'),
            }).eq('id', r.id);
            ok ? sent++ : failed++;
        }
    }

    const finalStatus = sent === 0 ? 'failed' : 'sent';
    await supabaseAdmin.from('mail_campaigns')
        .update({ status: finalStatus, sent_at: new Date().toISOString() })
        .eq('id', campaignId);

    return { sent, failed };
}
