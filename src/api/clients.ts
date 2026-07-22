import { supabase } from '../lib/supabase';
import type { Client, Lead, AdSpend, Service } from '../types';

export async function createClient(params: {
    name: string;
    username: string;
    email: string;
    password: string;
    services: Omit<Service, 'id'>[];
    quote_webhook_url?: string;
}): Promise<Client> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Non autenticato.');

    const res = await fetch('/api/create-client', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(params),
    });

    const json = await res.json();
    if (!res.ok) throw new Error(json.error || 'Errore nella creazione del cliente');
    return json.client as Client;
}

function unpackMwsSettings<T extends { services?: any; mws_fixed_fee?: number; mws_profit_percentage?: number; lead_intake_mode?: 'form' | 'api' }>(clientData: T): T {
    if (!clientData) return clientData;

    const c = { ...clientData };
    let raw = c.services;

    if (typeof raw === 'string') {
        try { raw = JSON.parse(raw); } catch { raw = []; }
    }

    const arr = Array.isArray(raw) ? raw : [];
    const mwsSettings = arr.find((s: any) => s?.id === 'mws_settings');
    const leadModeEntry = arr.find((s: any) => s?.name === '__lead_mode__');

    if (mwsSettings) {
        c.mws_fixed_fee = mwsSettings.mws_fixed_fee;
        c.mws_profit_percentage = mwsSettings.mws_profit_percentage;
    }

    if (leadModeEntry) {
        c.lead_intake_mode = leadModeEntry.mode || 'form';
    }

    c.services = arr.filter((s: any) => s?.id !== 'mws_settings' && s?.name !== '__lead_mode__');
    return c;
}

export async function getClients(startDate?: Date | null, endDate?: Date | null): Promise<Client[]> {
    const { data: clientsData, error } = await supabase.from('clients').select('*');
    if (error) throw new Error(error.message);

    return Promise.all(clientsData.map(async (client) => {
        let q = supabase.from('leads').select('*, notes(*), appointments(*), payment_plans(id)').eq('client_id', client.id).order('created_at', { ascending: false }).limit(10000);
        if (startDate) q = q.gte('created_at', startDate.toISOString());
        if (endDate) q = q.lte('created_at', endDate.toISOString());

        const [{ data: leads }, { data: adSpends }] = await Promise.all([
            q,
            supabase.from('ad_spends').select('*').eq('client_id', client.id),
        ]);

        const mappedLeads = (leads || []).map((l: any) => ({
            ...l,
            has_payment_plan: Array.isArray(l.payment_plans) && l.payment_plans.length > 0,
            is_manual: !!l.is_manual,
            payment_plans: undefined,
        })) as Lead[];

        return { ...unpackMwsSettings(client), leads: mappedLeads, adSpends: (adSpends || []) as AdSpend[] };
    }));
}

export async function getClientMailMarketingFlag(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('clients').select('mail_marketing_enabled').eq('user_id', userId).maybeSingle();
    if (error || !data) return false;
    return !!data.mail_marketing_enabled;
}

export async function getClientInstallmentsFlag(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('clients').select('installments_enabled').eq('user_id', userId).maybeSingle();
    if (error || !data) return false;
    return !!data.installments_enabled;
}

export async function getClientMetaFlag(userId: string): Promise<boolean> {
    const { data, error } = await supabase.from('clients').select('meta_enabled').eq('user_id', userId).maybeSingle();
    if (error || !data) return false;
    return !!data.meta_enabled;
}

export async function getClientByUserId(userId: string, startDate?: Date | null, endDate?: Date | null): Promise<Client | null> {
    const { data: client, error } = await supabase.from('clients').select('*').eq('user_id', userId).single();
    if (error || !client) return null;

    let q = supabase.from('leads').select('*, notes(*), appointments(*), payment_plans(id)').eq('client_id', client.id).order('created_at', { ascending: false }).limit(10000);
    if (startDate) q = q.gte('created_at', startDate.toISOString());
    if (endDate) q = q.lte('created_at', endDate.toISOString());

    const [{ data: leads }, { data: adSpends }] = await Promise.all([
        q,
        supabase.from('ad_spends').select('*').eq('client_id', client.id),
    ]);

    const mappedLeads = (leads || []).map((l: any) => ({
        ...l,
        has_payment_plan: Array.isArray(l.payment_plans) && l.payment_plans.length > 0,
        payment_plans: undefined,
    })) as Lead[];

    return { ...unpackMwsSettings(client), leads: mappedLeads, adSpends: (adSpends || []) as AdSpend[] } as Client;
}

export async function addClientForExistingUser(
    userId: string,
    name: string,
    username: string,
    services: Omit<Service, 'id'>[],
    quote_webhook_url?: string
): Promise<Client> {
    await supabase.from('users').update({ username, role: 'client', status: 'active' }).eq('id', userId);

    const servicesWithIds = services.map(s => ({
        ...s,
        id: `service_${Date.now()}_${Math.random()}`,
        fields: s.fields.map(f => ({ ...f, id: `field_${Date.now()}_${Math.random()}` })),
    }));

    const { data: newClient, error } = await supabase
        .from('clients')
        .insert({ name, user_id: userId, services: servicesWithIds, quote_webhook_url })
        .select()
        .single();

    if (error) throw new Error(error.message);
    return { ...newClient, leads: [], adSpends: [], services: newClient.services || [] } as Client;
}

export async function updateClient(
    clientId: string,
    updates: Partial<Pick<Client, 'name' | 'services' | 'mws_fixed_fee' | 'mws_profit_percentage' | 'quote_webhook_url' | 'message_templates' | 'quote_settings' | 'marketing_settings' | 'mail_marketing_enabled' | 'can_delete_leads' | 'can_edit_leads' | 'google_calendar_enabled' | 'google_calendar_id' | 'distance_settings' | 'installments_enabled' | 'meta_enabled' | 'meta_instagram_active'>>
): Promise<Client> {
    const { mws_fixed_fee, mws_profit_percentage, ...otherUpdates } = updates;
    const payload: any = { ...otherUpdates };

    const mwsProvided = mws_fixed_fee !== undefined || mws_profit_percentage !== undefined;

    if (mwsProvided || updates.services) {
        const { data: current, error } = await supabase.from('clients').select('services').eq('id', clientId).single();
        if (error) throw new Error(error.message);

        let currentServices = current.services || [];
        if (typeof currentServices === 'string') {
            try { currentServices = JSON.parse(currentServices); } catch { currentServices = []; }
        }

        let userServices = Array.isArray(currentServices) ? currentServices.filter((s: any) => s?.id !== 'mws_settings') : [];
        let mwsSettings: any = Array.isArray(currentServices) ? currentServices.find((s: any) => s?.id === 'mws_settings') : undefined;
        if (!mwsSettings) mwsSettings = { id: 'mws_settings', name: '_mws_settings' };

        if (updates.services) userServices = updates.services;
        if (mws_fixed_fee !== undefined) mwsSettings.mws_fixed_fee = mws_fixed_fee;
        if (mws_profit_percentage !== undefined) mwsSettings.mws_profit_percentage = mws_profit_percentage;

        payload.services = [...userServices, mwsSettings].map(s => ({
            ...s,
            id: s.id === 'mws_settings' ? 'mws_settings' : (s.id && !s.id.startsWith('new_') ? s.id : `service_${Date.now()}_${Math.random()}`),
            fields: s.fields?.map((f: any) => ({ ...f, id: f.id && !f.id.startsWith('new_') ? f.id : `field_${Date.now()}_${Math.random()}` })),
        }));
    }

    const { data, error } = await supabase.from('clients').update(payload).eq('id', clientId).select().single();
    if (error) throw new Error(error.message);
    return { ...unpackMwsSettings(data), leads: [], adSpends: [] } as Client;
}

export async function deleteClient(clientId: string): Promise<void> {
    const { data: client, error } = await supabase.from('clients').select('user_id').eq('id', clientId).single();
    if (error || !client) throw new Error('Client not found.');
    const { error: delError } = await supabase.from('users').delete().eq('id', client.user_id);
    if (delError) throw new Error(delError.message);
}

export async function deleteClientByUserId(userId: string): Promise<void> {
    const { error } = await supabase.from('users').delete().eq('id', userId);
    if (error) throw new Error(error.message);
}
