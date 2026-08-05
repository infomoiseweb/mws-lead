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

// Comprime un'immagine via canvas e la carica nel bucket "mail-assets/{clientId}/"
// Ogni upload crea un file univoco (timestamp) in modo da non sovrascrivere loghi diversi.
export async function uploadMailLogo(clientId: string, file: File, maxWidth = 600): Promise<string> {
    // Comprimi via canvas
    const compressed = await new Promise<Blob>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const w = Math.round(img.width * scale);
            const h = Math.round(img.height * scale);
            const canvas = document.createElement('canvas');
            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob => {
                if (blob) resolve(blob);
                else reject(new Error('Compressione fallita'));
            }, 'image/webp', 0.82);
        };
        img.onerror = () => reject(new Error('Impossibile leggere l\'immagine'));
        img.src = URL.createObjectURL(file);
    });

    const path = `${clientId}/logo_${Date.now()}.webp`;
    const { error } = await supabase.storage.from('mail-assets').upload(path, compressed, {
        upsert: false,
        cacheControl: '31536000',
        contentType: 'image/webp',
    });
    if (error) throw new Error(error.message);

    const { data } = supabase.storage.from('mail-assets').getPublicUrl(path);
    return data.publicUrl;
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
