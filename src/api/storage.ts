import { supabase } from '../lib/supabase';

// Carica/sostituisce il logo di un cliente nel bucket "client-logos".
// Path: "<client_id>/logo.<ext>" — un solo file per cliente, sovrascritto ad ogni upload.
export async function uploadClientLogo(clientId: string, file: File): Promise<string> {
    const ext = file.name.split('.').pop() || 'png';
    const path = `${clientId}/logo.${ext}`;

    const { error } = await supabase.storage.from('client-logos').upload(path, file, {
        upsert: true,
        cacheControl: '3600',
    });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('client-logos').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
}

// Carica/sostituisce il PDF di un preventivo nel bucket "quote-pdfs", per poterlo
// condividere via link (es. WhatsApp). Path: "<client_id>/<quote_id>.pdf".
export async function uploadQuotePdf(clientId: string, quoteId: string, pdf: Blob): Promise<string> {
    const path = `${clientId}/${quoteId}.pdf`;

    const { error } = await supabase.storage.from('quote-pdfs').upload(path, pdf, {
        upsert: true,
        cacheControl: '3600',
        contentType: 'application/pdf',
    });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('quote-pdfs').getPublicUrl(path);
    return `${data.publicUrl}?t=${Date.now()}`;
}

// Restituisce un link corto (es. https://tuodominio.it/api/q/Ab3dE9fG) che reindirizza
// al PDF del preventivo, senza esporre l'URL del progetto Supabase.
export async function getQuoteShareUrl(quoteId: string, clientId: string): Promise<string> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Utente non autenticato.');

    const res = await fetch('/api/quote-share-link', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ quoteId, clientId }),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }

    const { code } = await res.json();
    return `${window.location.origin}/api/q/${code}`;
}
