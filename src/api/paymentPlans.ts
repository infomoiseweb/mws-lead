import { supabase } from '@lib/supabase';
import type { PaymentPlan, Installment } from '../types';

export async function getPaymentPlans(clientId?: string): Promise<PaymentPlan[]> {
    let q = supabase
        .from('payment_plans')
        .select(`*, installments(*), leads(data, service), clients(name), quotes(quote_number_display)`)
        .order('created_at', { ascending: false });
    if (clientId) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []) as PaymentPlan[];
}

export async function getPaymentPlanByLead(leadId: string): Promise<PaymentPlan | null> {
    const { data, error } = await supabase
        .from('payment_plans')
        .select('*, installments(*)')
        .eq('lead_id', leadId)
        .maybeSingle();
    if (error) throw new Error(error.message);
    return data as PaymentPlan | null;
}

export async function createPaymentPlan(plan: {
    client_id: string;
    lead_id: string;
    quote_id?: string;
    total_amount: number;
    notes?: string;
    installments: { amount: number; due_date: string; notes?: string }[];
}): Promise<PaymentPlan> {
    const { installments: rows, ...planData } = plan;
    const { data, error } = await supabase.from('payment_plans').insert(planData).select().single();
    if (error) throw new Error(error.message);
    const planId = data.id;
    if (rows.length > 0) {
        const { error: ie } = await supabase.from('installments').insert(
            rows.map(r => ({ ...r, payment_plan_id: planId }))
        );
        if (ie) throw new Error(ie.message);
    }
    // Imposta automaticamente lo stato della lead a "A Rate"
    await supabase.from('leads').update({ status: 'A Rate' }).eq('id', plan.lead_id);
    return getPaymentPlanByLead(plan.lead_id) as Promise<PaymentPlan>;
}

export async function updatePaymentPlan(id: string, updates: Partial<Pick<PaymentPlan, 'total_amount' | 'notes'>>): Promise<void> {
    const { error } = await supabase.from('payment_plans').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function deletePaymentPlan(id: string): Promise<void> {
    const { error } = await supabase.from('payment_plans').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

export async function markInstallmentPaid(id: string, paidAt: string | null): Promise<void> {
    const { error } = await supabase.from('installments').update({ paid_at: paidAt }).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function addInstallment(planId: string, installment: { amount: number; due_date: string; notes?: string }): Promise<Installment> {
    const { data, error } = await supabase.from('installments')
        .insert({ ...installment, payment_plan_id: planId }).select().single();
    if (error) throw new Error(error.message);
    return data as Installment;
}

export async function updateInstallment(id: string, updates: Partial<Pick<Installment, 'amount' | 'due_date' | 'notes'>>): Promise<void> {
    const { error } = await supabase.from('installments').update(updates).eq('id', id);
    if (error) throw new Error(error.message);
}

export async function deleteInstallment(id: string): Promise<void> {
    const { error } = await supabase.from('installments').delete().eq('id', id);
    if (error) throw new Error(error.message);
}

// Ritorna il fatturato mensile da rate pagate per un cliente (o tutti se adminMode)
export async function getInstallmentRevenueByMonth(clientId?: string): Promise<{ month: string; total_paid: number }[]> {
    let q = supabase.from('installment_revenue_by_month').select('month, total_paid');
    if (clientId) q = q.eq('client_id', clientId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []).map(r => ({ month: r.month as string, total_paid: Number(r.total_paid) }));
}

// Proiezione futura: importo atteso per i prossimi N mesi da rate non ancora pagate
export async function getInstallmentForecast(clientId?: string, months = 6): Promise<{ month: string; expected: number }[]> {
    const today = new Date();
    const result: { month: string; expected: number }[] = [];
    for (let i = 0; i < months; i++) {
        const d = new Date(today.getFullYear(), today.getMonth() + i, 1);
        result.push({ month: d.toISOString().slice(0, 7), expected: 0 });
    }
    const start = result[0].month + '-01';
    const last = result[result.length - 1];
    const lastDay = new Date(new Date(last.month + '-01').getFullYear(), new Date(last.month + '-01').getMonth() + 1, 0);
    const end = lastDay.toISOString().slice(0, 10);

    let q = supabase
        .from('installments')
        .select('amount, due_date, paid_at, payment_plans(client_id)')
        .gte('due_date', start)
        .lte('due_date', end)
        .is('paid_at', null);
    const { data, error } = await q;
    if (error) return result;

    for (const inst of data || []) {
        if (clientId && (inst as any).payment_plans?.client_id !== clientId) continue;
        const m = (inst.due_date as string).slice(0, 7);
        const entry = result.find(r => r.month === m);
        if (entry) entry.expected += Number(inst.amount);
    }
    return result;
}

// Tutte le rate con scadenza nel mese corrente (o specificato YYYY-MM)
export async function getInstallmentsDueThisMonth(clientId?: string, month?: string): Promise<(Installment & { payment_plans: { lead_id: string; client_id: string; total_amount: number; leads: { data: Record<string, string>; service?: string } | null } | null })[]> {
    const m = month || new Date().toISOString().slice(0, 7);
    const start = `${m}-01`;
    const end = new Date(new Date(start).getFullYear(), new Date(start).getMonth() + 1, 0).toISOString().slice(0, 10);

    let q = supabase
        .from('installments')
        .select('*, payment_plans(lead_id, client_id, total_amount, leads(data, service))')
        .gte('due_date', start)
        .lte('due_date', end)
        .order('due_date');

    if (clientId) q = q.eq('payment_plans.client_id', clientId);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data || []) as any;
}
