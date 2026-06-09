import { supabase } from '../lib/supabase';
import type { SavedForm } from '../types';

export async function getForms(): Promise<SavedForm[]> {
    const { data, error } = await supabase.from('saved_forms').select('*');
    if (error) throw new Error(error.message);
    return data as SavedForm[];
}

export async function saveForm(form: Omit<SavedForm, 'id' | 'created_at'>): Promise<SavedForm> {
    const { data, error } = await supabase.from('saved_forms').insert(form).select().single();
    if (error) throw new Error(error.message);
    return data as SavedForm;
}

export async function updateForm(formId: string, updates: Partial<Omit<SavedForm, 'id' | 'created_at'>>): Promise<SavedForm> {
    const { data, error } = await supabase.from('saved_forms').update(updates).eq('id', formId).select().single();
    if (error) throw new Error(error.message);
    return data as SavedForm;
}

export async function deleteForm(formId: string): Promise<void> {
    const { error } = await supabase.from('saved_forms').delete().eq('id', formId);
    if (error) throw new Error(error.message);
}
