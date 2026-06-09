import { supabase } from '../lib/supabase';
import type { MwsMonthlyRevenue } from '../types';

export async function getMwsMonthlyRevenues(clientId?: string): Promise<MwsMonthlyRevenue[]> {
    let q = supabase.from('mws_monthly_revenue').select('*');
    if (clientId) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data as MwsMonthlyRevenue[];
}

export async function upsertMwsRevenue(
    revenueData: Omit<MwsMonthlyRevenue, 'id' | 'created_at' | 'updated_at'>
): Promise<MwsMonthlyRevenue> {
    const { data, error } = await supabase
        .from('mws_monthly_revenue')
        .upsert(revenueData, { onConflict: 'client_id, month' })
        .select()
        .single();
    if (error) throw new Error(error.message);
    return data as MwsMonthlyRevenue;
}
