import { supabase } from '../lib/supabase';
import type { Appointment, Lead, CalendarAppointment } from '../types';

function extractLeadName(data: Record<string, string>): string {
    const nameKeys = ['nome', 'name', 'nome_cognome', 'full_name', 'nominativo', 'nome e cognome'];
    for (const key of nameKeys) {
        const val = Object.entries(data).find(([k]) => k.toLowerCase().replace(/\s/g, '_') === key.replace(/\s/g, '_'))?.[1];
        if (val?.trim()) return val.trim();
    }
    // fallback: primo campo non vuoto
    return Object.values(data).find(v => v?.trim()) || '';
}

function extractLeadPhone(data: Record<string, string>): string {
    const phoneKeys = ['telefono', 'phone', 'tel', 'cellulare', 'mobile', 'numero'];
    for (const key of phoneKeys) {
        const val = Object.entries(data).find(([k]) => k.toLowerCase().includes(key))?.[1];
        if (val?.trim()) return val.trim();
    }
    return '';
}

function extractLeadEmail(data: Record<string, string>): string {
    const val = Object.entries(data).find(([k]) => k.toLowerCase().includes('mail') || k.toLowerCase().includes('email'))?.[1];
    return val?.trim() || '';
}

interface SyncPayload extends Partial<Appointment> {
    lead_data?: Record<string, string>;
    lead_service?: string;
}

async function syncGoogleCalendar(
    action: 'create' | 'update' | 'delete',
    clientId: string,
    appointmentId: string,
    payload?: SyncPayload
): Promise<void> {
    try {
        const { data: clientData } = await supabase
            .from('clients')
            .select('google_calendar_enabled')
            .eq('id', clientId)
            .single();
        if (!clientData?.google_calendar_enabled) return;

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        await fetch('/api/google-calendar', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ action, client_id: clientId, appointment_id: appointmentId, appointment: payload }),
        });
    } catch {
        // Non blocca il flusso principale
    }
}

export async function addAppointment(appointmentData: Omit<Appointment, 'id' | 'created_at'>): Promise<Lead> {
    const { data: inserted, error } = await supabase.from('appointments').insert(appointmentData).select().single();
    if (error) throw new Error(error.message);

    const { data, error: leadErr } = await supabase
        .from('leads')
        .select('*, notes(*), appointments(*)')
        .eq('id', appointmentData.lead_id)
        .single();
    if (leadErr) throw new Error(leadErr.message);

    if (appointmentData.client_id) {
        const leadData = (data as Lead).data || {};
        const leadService = (data as Lead).service;
        syncGoogleCalendar('create', appointmentData.client_id, inserted.id, {
            ...appointmentData,
            lead_data: leadData,
            lead_service: leadService,
        });
    }

    return data as Lead;
}

export async function addGeneralAppointment(
    appointmentData: Omit<Appointment, 'id' | 'created_at' | 'lead_id' | 'client_id'>
): Promise<void> {
    const { error } = await supabase.from('appointments').insert(appointmentData);
    if (error) throw new Error(error.message);
}

export async function updateAppointment(
    appointmentId: string,
    updates: Partial<Omit<Appointment, 'id' | 'created_at'>>
): Promise<void> {
    const { error } = await supabase.from('appointments').update(updates).eq('id', appointmentId);
    if (error) throw new Error(error.message);

    if (updates.client_id) {
        syncGoogleCalendar('update', updates.client_id, appointmentId, updates);
    }
}

export async function deleteAppointment(appointmentId: string, clientId?: string): Promise<void> {
    if (clientId) {
        syncGoogleCalendar('delete', clientId, appointmentId);
    }
    const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
    if (error) throw new Error(error.message);
}

export async function getFutureAppointmentsForClient(clientId: string): Promise<CalendarAppointment[]> {
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
        .from('appointments')
        .select('*, leads(id, data)')
        .eq('client_id', clientId)
        .gte('appointment_date', today)
        .not('location_lat', 'is', null)
        .order('appointment_date', { ascending: true });

    if (error) throw new Error(error.message);
    return data as CalendarAppointment[];
}

export async function getAppointmentsForCalendar(): Promise<CalendarAppointment[]> {
    const { data, error } = await supabase
        .from('appointments')
        .select('*, leads(*, notes(*), quotes(*)), clients(name, user_id)')
        .order('appointment_date', { ascending: false })
        .order('appointment_time', { ascending: false });

    if (error) throw new Error(error.message);
    return data as CalendarAppointment[];
}

// Helper esportato per estrarre nome lead (usato da CalendarPage per passare clientId al delete)
export { extractLeadName, extractLeadPhone, extractLeadEmail };
