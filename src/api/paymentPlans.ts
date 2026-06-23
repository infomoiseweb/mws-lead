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
