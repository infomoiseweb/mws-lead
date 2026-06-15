import { supabase } from '../lib/supabase';
import type { MailDomain, MailMarketingSettings, MailTemplate, MailCampaign, MailCampaignRecipient, MailAutomation, MailMarketingOverviewClient } from '../types';

async function authHeader(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Utente non autenticato.');
    return { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' };
}

// ─── Dominio email (Resend) ────────────────────────────────────────────────────

export async function getMailDomain(): Promise<MailDomain | null> {
    const headers = await authHeader();
    const res = await fetch('/api/mail-domains', { method: 'GET', headers });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { domain } = await res.json();
    return domain ?? null;
}

export async function createMailDomain(domain: string): Promise<MailDomain> {
    const headers = await authHeader();
    const res = await fetch('/api/mail-domains', { method: 'POST', headers, body: JSON.stringify({ domain }) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { domain: created } = await res.json();
    return created;
}

export async function verifyMailDomain(domainId: string): Promise<MailDomain> {
    const headers = await authHeader();
    const res = await fetch('/api/mail-domains', { method: 'POST', headers, body: JSON.stringify({ action: 'verify', domainId }) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { domain: updated } = await res.json();
    return updated;
}

export async function deleteMailDomain(domainId: string): Promise<void> {
    const headers = await authHeader();
    const res = await fetch('/api/mail-domains', { method: 'DELETE', headers, body: JSON.stringify({ domainId }) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
}

// ─── Impostazioni di branding mail marketing ───────────────────────────────────

export async function updateMarketingSettings(clientId: string, settings: MailMarketingSettings): Promise<MailMarketingSettings | undefined> {
    const { data, error } = await supabase
        .from('clients')
        .update({ marketing_settings: settings })
        .eq('id', clientId)
        .select('marketing_settings')
        .single();

    if (error) throw new Error(error.message);
    return data?.marketing_settings;
}

// ─── Template email ─────────────────────────────────────────────────────────

export async function getMailTemplates(clientId: string): Promise<MailTemplate[]> {
    const { data, error } = await supabase
        .from('mail_templates')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function saveMailTemplate(template: Partial<MailTemplate> & { client_id: string }): Promise<MailTemplate> {
    if (template.id) {
        const { id, client_id, created_at, updated_at, ...updates } = template;
        const { data, error } = await supabase
            .from('mail_templates')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    const { id, created_at, updated_at, ...insertData } = template;
    const { data, error } = await supabase
        .from('mail_templates')
        .insert(insertData)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMailTemplate(templateId: string): Promise<void> {
    const { error } = await supabase.from('mail_templates').delete().eq('id', templateId);
    if (error) throw new Error(error.message);
}

// ─── Campagne email ──────────────────────────────────────────────────────────

export async function getMailCampaigns(clientId: string): Promise<MailCampaign[]> {
    const { data, error } = await supabase
        .from('mail_campaigns')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function saveMailCampaign(campaign: Partial<MailCampaign> & { client_id: string }): Promise<MailCampaign> {
    if (campaign.id) {
        const { id, client_id, created_at, sent_at, status, ...updates } = campaign;
        const { data, error } = await supabase
            .from('mail_campaigns')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    const { id, created_at, sent_at, status, ...insertData } = campaign;
    const { data, error } = await supabase
        .from('mail_campaigns')
        .insert(insertData)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMailCampaign(campaignId: string): Promise<void> {
    const { error } = await supabase.from('mail_campaigns').delete().eq('id', campaignId);
    if (error) throw new Error(error.message);
}

export async function getMailCampaignRecipients(campaignId: string): Promise<MailCampaignRecipient[]> {
    const { data, error } = await supabase
        .from('mail_campaign_recipients')
        .select('*')
        .eq('campaign_id', campaignId);

    if (error) throw new Error(error.message);
    return data || [];
}

// ─── Automazioni email ───────────────────────────────────────────────────────

export async function getMailAutomations(clientId: string): Promise<MailAutomation[]> {
    const { data, error } = await supabase
        .from('mail_automations')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);
    return data || [];
}

export async function saveMailAutomation(automation: Partial<MailAutomation> & { client_id: string }): Promise<MailAutomation> {
    if (automation.id) {
        const { id, client_id, created_at, ...updates } = automation;
        const { data, error } = await supabase
            .from('mail_automations')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (error) throw new Error(error.message);
        return data;
    }

    const { id, created_at, ...insertData } = automation;
    const { data, error } = await supabase
        .from('mail_automations')
        .insert(insertData)
        .select()
        .single();

    if (error) throw new Error(error.message);
    return data;
}

export async function deleteMailAutomation(automationId: string): Promise<void> {
    const { error } = await supabase.from('mail_automations').delete().eq('id', automationId);
    if (error) throw new Error(error.message);
}

// ─── Vista admin ────────────────────────────────────────────────────────────

export async function getMailMarketingOverview(): Promise<MailMarketingOverviewClient[]> {
    const { data, error } = await supabase
        .from('clients')
        .select('id, name, mail_marketing_enabled, mail_domains(domain, status), mail_campaigns(id, name, status, sent_at, mail_campaign_recipients(status))')
        .order('name');

    if (error) throw new Error(error.message);
    return (data || []) as unknown as MailMarketingOverviewClient[];
}

export async function setClientMailMarketingEnabled(clientId: string, enabled: boolean): Promise<void> {
    const { error } = await supabase.from('clients').update({ mail_marketing_enabled: enabled }).eq('id', clientId);
    if (error) throw new Error(error.message);
}

export async function sendMailCampaign(campaignId: string): Promise<MailCampaign> {
    const headers = await authHeader();
    const res = await fetch('/api/send-mail-campaign', { method: 'POST', headers, body: JSON.stringify({ campaignId }) });
    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
    const { campaign } = await res.json();
    return campaign;
}
