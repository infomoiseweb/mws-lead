import { Resend } from 'resend';
import { SupabaseClient } from '@supabase/supabase-js';
import { renderMailTemplate, buildUnsubscribeUrl, findLeadEmail, findLeadName, injectTracking, buildMailHeaders, getReplyTo, htmlToText } from './mailRender.js';

const BATCH_SIZE = 90;
// Resend accetta ~2 richieste/secondo
const RESEND_THROTTLE_MS = 550;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
    const replyTo = getReplyTo(client.marketing_settings);

    // Re-invio della stessa campagna: chi l'ha già ricevuta viene saltato, i tentativi
    // falliti/in sospeso precedenti vengono sostituiti dal nuovo tentativo
    const { data: previousRecipients } = await supabaseAdmin
        .from('mail_campaign_recipients')
        .select('email, status')
        .eq('campaign_id', campaignId);
    const alreadySent = new Set((previousRecipients || [])
        .filter((r: any) => r.status === 'sent' || r.status === 'bounced')
        .map((r: any) => String(r.email).toLowerCase()));
    await supabaseAdmin.from('mail_campaign_recipients')
        .delete()
        .eq('campaign_id', campaignId)
        .in('status', ['failed', 'pending']);

    // Pre-inserisce i recipient
    const pendingRows: any[] = [];
    const queuedEmails = new Set<string>();
    let skippedUnsubscribed = 0;
    for (const lead of leads || []) {
        const email = findLeadEmail(lead.data || {});
        if (!email) continue;
        if (unsubscribedEmails.has(email.toLowerCase())) { skippedUnsubscribed++; continue; }
        // Già ricevuta in un invio precedente, o stessa email su più lead
        if (alreadySent.has(email) || queuedEmails.has(email)) continue;
        queuedEmails.add(email);
        pendingRows.push({
            campaign_id: campaignId,
            lead_id: lead.id,
            email,
            lead_name: findLeadName(lead.data || {}),
            status: 'pending',
        });
    }

    if (pendingRows.length === 0 && alreadySent.size > 0) {
        await supabaseAdmin.from('mail_campaigns').update({ status: 'sent' }).eq('id', campaignId);
        return { sent: 0, failed: 0, error: 'Tutte le lead selezionate hanno già ricevuto questa campagna' };
    }

    if (pendingRows.length === 0) {
        await supabaseAdmin.from('mail_campaigns').update({ status: 'failed' }).eq('id', campaignId);
        return {
            sent: 0, failed: 0,
            error: skippedUnsubscribed > 0
                ? `Nessun destinatario: ${skippedUnsubscribed} lead si ${skippedUnsubscribed === 1 ? 'è disiscritta' : 'sono disiscritte'} dalle mail e le altre non hanno un'email valida`
                : 'Nessuna lead con email valida',
        };
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

    const buildMessage = (r: any) => {
        const unsubscribeUrl = buildUnsubscribeUrl(baseUrl, r.email, client.id);
        const vars: Record<string, string> = {
            nome: r.lead_name || '',
            logo_url: branding.logo_url || '',
            brand_name: branding.brand_name || client.name,
            primary_color: branding.primary_color || '#2563eb',
            secondary_color: branding.secondary_color || '#1e293b',
            footer_text: branding.footer_text || client.name,
            unsubscribe_link: unsubscribeUrl,
        };
        const rawHtml = renderMailTemplate(template.body_html, vars);
        const trackedHtml = injectTracking(rawHtml, baseUrl, r.id);
        const subject = renderMailTemplate(campaign.subject || template.subject_template, vars);
        return {
            from: fromAddress,
            to: [r.email],
            subject,
            html: trackedHtml,
            text: htmlToText(rawHtml),
            headers: buildMailHeaders(unsubscribeUrl),
            ...(replyTo ? { replyTo } : {}),
        };
    };

    const markRecipient = async (r: any, ok: boolean, errorMessage?: string) => {
        await supabaseAdmin.from('mail_campaign_recipients').update({
            status: ok ? 'sent' : 'failed',
            sent_at: ok ? new Date().toISOString() : null,
            error: ok ? null : (errorMessage || 'Invio non riuscito'),
        }).eq('id', r.id);
        ok ? sent++ : failed++;
    };

    // Resend rifiuta l'intero batch se anche un solo messaggio non è valido: in quel caso il
    // gruppo viene diviso a metà finché l'indirizzo errato resta isolato (≈2·log2(n) richieste,
    // invece di n invii singoli che sforerebbero rate limit e timeout della funzione)
    const sendGroup = async (group: any[]): Promise<void> => {
        const { data: batchResult, error: batchError } = await resend.batch.send(group.map(buildMessage));
        if (!batchError) {
            for (let j = 0; j < group.length; j++) await markRecipient(group[j], !!batchResult?.data?.[j]);
            return;
        }
        if (group.length === 1) {
            await markRecipient(group[0], false, batchError.message);
            return;
        }
        await sleep(RESEND_THROTTLE_MS);
        const mid = Math.ceil(group.length / 2);
        await sendGroup(group.slice(0, mid));
        await sleep(RESEND_THROTTLE_MS);
        await sendGroup(group.slice(mid));
    };

    for (let i = 0; i < insertedRecipients.length; i += BATCH_SIZE) {
        if (i > 0) await sleep(RESEND_THROTTLE_MS);
        await sendGroup(insertedRecipients.slice(i, i + BATCH_SIZE));
    }

    const finalStatus = sent === 0 && alreadySent.size === 0 ? 'failed' : 'sent';
    await supabaseAdmin.from('mail_campaigns')
        .update({ status: finalStatus, sent_at: new Date().toISOString() })
        .eq('id', campaignId);

    return { sent, failed };
}
