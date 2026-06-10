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
