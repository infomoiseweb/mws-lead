import { supabase } from '../lib/supabase';
import type { Lead } from '../types';

interface AddLeadOptions {
    clientId: string;
    leadData: Record<string, string>;
    service?: string;
    status?: Lead['status'];
    value?: number;
    createdAt?: string;
    isManual?: boolean;
}

export async function addLead({ clientId, leadData, service, status, value, createdAt, isManual }: AddLeadOptions): Promise<Lead> {
    const payload: Record<string, any> = {
        client_id: clientId,
        data: leadData,
        service,
        status: status || 'Nuovo',
        value,
        is_manual: isManual ?? false,
    };
    if (createdAt) payload.created_at = new Date(createdAt).toISOString();

    const { data, error } = await supabase.from('leads').insert(payload).select().single();
    if (error) throw new Error(error.message);
    const newLead = data as Lead;

    // Notifiche (non bloccante)
    try {
        const { data: clientData } = await supabase.from('clients').select('user_id, name').eq('id', clientId).single();
        const { data: adminUser } = await supabase.from('users').select('id').eq('role', 'admin').single();

        if (clientData && adminUser) {
            await supabase.from('notifications').insert([
                {
                    user_id: clientData.user_id,
                    title: 'Nuovo Lead Ricevuto!',
                    message: `Hai ricevuto un nuovo lead: '${leadData.nome || 'N/D'}'. Clicca per vedere i dettagli.`,
                    lead_id: newLead.id,
                    client_id: clientId,
                },
                {
                    user_id: adminUser.id,
                    title: `Nuovo Lead per ${clientData.name}`,
                    message: `È stato registrato un nuovo lead '${leadData.nome || 'N/D'}' per il cliente '${clientData.name}'.`,
                    lead_id: newLead.id,
                    client_id: clientId,
                },
            ]);
        }
    } catch (e) {
        console.error('Failed to create notifications:', e);
    }

    return newLead;
}

export async function addHistoricalLead(options: {
    clientId: string;
    originalLeadData: Record<string, string>;
    service: string;
    value: number;
    date: string;
    notes?: string;
}): Promise<Lead> {
    const { clientId, originalLeadData, service, value, date, notes } = options;

    const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
            client_id: clientId,
            data: { ...originalLeadData, _is_historical: 'true' },
            service,
            status: 'Vinto' as const,
            value,
            created_at: new Date(date).toISOString(),
        })
        .select()
        .single();

    if (error) throw new Error(error.message);

    if (notes?.trim()) {
        await supabase.from('notes').insert({ lead_id: newLead.id, content: notes });
    }

    const { data: final, error: fetchErr } = await supabase.from('leads').select('*, notes(*), appointments(*)').eq('id', newLead.id).single();
    if (fetchErr) throw new Error(fetchErr.message);
    return final as Lead;
}

export async function updateHistoricalLead(
    leadId: string,
    updates: { service: string; value: number; date: string; notes?: string },
    existingNoteId?: string
): Promise<Lead> {
    const { service, value, date, notes } = updates;

    const { data: updated, error } = await supabase
        .from('leads')
        .update({ service, value, created_at: new Date(date).toISOString() })
        .eq('id', leadId)
        .select()
        .single();

    if (error) throw new Error(error.message);

    if (notes !== undefined) {
        if (notes.trim()) {
            if (existingNoteId) {
                await supabase.from('notes').update({ content: notes }).eq('id', existingNoteId);
            } else {
                await supabase.from('notes').insert({ lead_id: leadId, content: notes });
            }
        } else if (existingNoteId) {
            await supabase.from('notes').delete().eq('id', existingNoteId);
        }
    }

    const { data: final, error: fetchErr } = await supabase.from('leads').select('*, notes(*), appointments(*)').eq('id', updated.id).single();
    if (fetchErr) throw new Error(fetchErr.message);
    return final as Lead;
}

export async function updateLead(_clientId: string, leadId: string, updates: Partial<Lead>): Promise<Lead> {
    const { data, error } = await supabase.from('leads').update(updates).eq('id', leadId).select('*, notes(*), appointments(*)').single();
    if (error) throw new Error(error.message);
    return data as Lead;
}

export async function getLeadById(leadId: string): Promise<Lead | null> {
    const { data, error } = await supabase.from('leads').select('*, notes(*), appointments(*)').eq('id', leadId).single();
    if (error) return null;
    return data as Lead;
}

export async function deleteLead(_clientId: string, leadId: string): Promise<void> {
    const { error } = await supabase.from('leads').delete().eq('id', leadId);
    if (error) throw new Error(error.message);
}

export async function deleteMultipleLeads(leadsToDelete: { clientId: string; leadId: string }[]): Promise<void> {
    const ids = leadsToDelete.map(l => l.leadId);
    const { error } = await supabase.from('leads').delete().in('id', ids);
    if (error) throw new Error(error.message);
}

export async function addNoteToLead(_clientId: string, leadId: string, noteContent: string): Promise<Lead> {
    const { error } = await supabase.from('notes').insert({ lead_id: leadId, content: noteContent });
    if (error) throw new Error(error.message);

    const { data, error: leadErr } = await supabase.from('leads').select('*, notes(*), appointments(*)').eq('id', leadId).single();
    if (leadErr) throw new Error(leadErr.message);
    return data as Lead;
}

export async function updateNote(noteId: string, content: string): Promise<void> {
    const { error } = await supabase.from('notes').update({ content }).eq('id', noteId);
    if (error) throw new Error(error.message);
}

export async function deleteNote(noteId: string): Promise<void> {
    const { error } = await supabase.from('notes').delete().eq('id', noteId);
    if (error) throw new Error(error.message);
}
