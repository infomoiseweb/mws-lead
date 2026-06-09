import { supabase } from '../lib/supabase';
import type { Appointment, Lead, CalendarAppointment } from '../types';

export async function addAppointment(appointmentData: Omit<Appointment, 'id' | 'created_at'>): Promise<Lead> {
    const { error } = await supabase.from('appointments').insert(appointmentData);
    if (error) throw new Error(error.message);

    const { data, error: leadErr } = await supabase
        .from('leads')
        .select('*, notes(*), appointments(*)')
        .eq('id', appointmentData.lead_id)
        .single();

    if (leadErr) throw new Error(leadErr.message);
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
}

export async function deleteAppointment(appointmentId: string): Promise<void> {
    const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
    if (error) throw new Error(error.message);
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
