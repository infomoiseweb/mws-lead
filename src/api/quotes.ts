import { supabase } from '../lib/supabase';
import type { Quote, QuoteWithDetails } from '../types';

export async function getQuotesForLead(leadId: string): Promise<Quote[]> {
    const { data, error } = await supabase.rpc('get_quotes_for_lead', { p_lead_id: leadId });
    if (error) { console.error(error.message); return []; }
    return data as Quote[];
}

export async function getAllQuotes(): Promise<QuoteWithDetails[]> {
    const { data, error } = await supabase.rpc('get_all_quotes_with_details');
    if (error) throw new Error(error.message);
    return (data || []) as QuoteWithDetails[];
}

export async function saveQuote(quoteData: Omit<Quote, 'id' | 'created_at' | 'status'>): Promise<Quote> {
    const { data, error } = await supabase.rpc('create_quote', { quote_data: quoteData });
    if (error) throw new Error(`Errore RPC: ${error.message}. Dettagli: ${error.details || 'N/D'}`);
    return data as Quote;
}

export async function updateQuote(quoteId: string, quoteData: Partial<Omit<Quote, 'id' | 'created_at'>>): Promise<Quote> {
    const { data, error } = await supabase.rpc('update_quote', { p_quote_id: quoteId, quote_data: quoteData });
    if (error) throw new Error(`Errore RPC: ${error.message}. Dettagli: ${error.details || 'N/D'}`);
    return data as Quote;
}

export async function updateQuoteStatus(quoteId: string, status: Quote['status']): Promise<void> {
    const { error } = await supabase.rpc('update_quote_status_and_handle_accepted', {
        p_quote_id: quoteId,
        p_new_status: status,
    });
    if (error) throw new Error(`Failed to update quote status: ${error.message}`);

    if (status === 'accepted') {
        await _sendWebhook(quoteId, 'quote_accepted');
    }
}

export async function deleteQuote(quoteId: string): Promise<void> {
    const { error } = await supabase.rpc('delete_quote', { p_quote_id: quoteId });
    if (error) throw new Error(`Errore RPC: ${error.message}`);
}

export async function getQuoteById(quoteId: string): Promise<Quote> {
    const { data, error } = await supabase.from('quotes').select('*').eq('id', quoteId);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) throw new Error(`Quote ${quoteId} not found.`);
    return data[0] as Quote;
}

async function _getWebhookInfo(quoteId: string) {
    const { data, error } = await supabase.rpc('get_webhook_data_for_quote', { p_quote_id: quoteId });
    if (error) throw new Error(`Impossibile recuperare i dati webhook: ${error.message}`);
    const info = Array.isArray(data) ? data[0] : data;
    if (!info?.webhook_url || !info?.quote_data) throw new Error('URL webhook non configurato per questo cliente.');
    return info;
}

async function _sendWebhook(quoteId: string, event: string): Promise<void> {
    try {
        const info = await _getWebhookInfo(quoteId);
        const response = await fetch(info.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ event, quote: { ...info.quote_data, items: info.quote_data.items || [] } }),
        });
        if (!response.ok) console.error(`Webhook failed: ${response.status}`);
    } catch (e: any) {
        console.error(`Webhook error: ${e.message}`);
    }
}
