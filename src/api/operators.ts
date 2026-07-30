import { supabase } from '../lib/supabase';
import type { Operator, LeadStatusLog } from '../types';

export async function getOperators(clientId: string): Promise<Operator[]> {
    const { data, error } = await supabase
        .from('operators')
        .select('*')
        .eq('client_id', clientId)
        .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
}

export async function addOperator(clientId: string, name: string, color: string): Promise<Operator> {
    const { data, error } = await supabase
        .from('operators')
        .insert({ client_id: clientId, name, color })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data;
}

export async function updateOperator(id: string, name: string, color: string): Promise<void> {
    const { error } = await supabase.from('operators').update({ name, color }).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function deleteOperator(id: string): Promise<void> {
    const { error } = await supabase.from('operators').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export async function logStatusChange(
    leadId: string,
    clientId: string,
    newStatus: string,
    oldStatus?: string,
    operatorId?: string | null,
    operatorName?: string | null,
    note?: string
): Promise<void> {
    const { error } = await supabase.from('lead_status_logs').insert({
        lead_id: leadId,
        client_id: clientId,
        operator_id: operatorId || null,
        operator_name: operatorName || null,
        old_status: oldStatus || null,
        new_status: newStatus,
        note: note || null,
    });
    if (error) throw new Error(error.message);
}

// Ritorna l'ultimo operatore per ogni lead del cliente — una sola query
export async function getLastOperatorPerLead(clientId: string): Promise<Record<string, { name: string; color: string | null }>> {
    const { data, error } = await supabase
        .from('lead_status_logs')
        .select('lead_id, operator_name, operator_id')
        .eq('client_id', clientId)
        .not('operator_name', 'is', null)
        .order('created_at', { ascending: false });

    if (error || !data) return {};

    // Prende solo il primo record per lead_id (il più recente grazie all'order)
    const map: Record<string, { name: string; color: string | null }> = {};
    for (const row of data) {
        if (!map[row.lead_id]) {
            map[row.lead_id] = { name: row.operator_name, color: null };
        }
    }
    return map;
}

export async function getLeadStatusLogs(leadId: string): Promise<LeadStatusLog[]> {
    const { data, error } = await supabase
        .from('lead_status_logs')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
}
