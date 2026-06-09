import { supabase } from '../lib/supabase';
import type { AdSpend } from '../types';

export async function addAdSpend(clientId: string, spendData: Omit<AdSpend, 'id' | 'client_id' | 'created_at'>): Promise<AdSpend> {
    const { data, error } = await supabase.from('ad_spends').insert({ client_id: clientId, ...spendData }).select().single();
    if (error) throw new Error(error.message);
    return data as AdSpend;
}

export async function updateAdSpend(_clientId: string, spendId: string, updates: Partial<Omit<AdSpend, 'id'>>): Promise<AdSpend> {
    const { data, error } = await supabase.from('ad_spends').update(updates).eq('id', spendId).select().single();
    if (error) throw new Error(error.message);
    return data as AdSpend;
}

export async function deleteAdSpend(_clientId: string, spendId: string): Promise<void> {
    const { error } = await supabase.from('ad_spends').delete().eq('id', spendId);
    if (error) throw new Error(error.message);
}

export async function deleteMultipleAdSpends(_clientId: string, spendIds: string[]): Promise<void> {
    if (!spendIds.length) return;
    const { error } = await supabase.from('ad_spends').delete().in('id', spendIds);
    if (error) throw new Error(error.message);
}
