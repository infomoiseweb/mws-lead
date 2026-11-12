import * as crypto from 'crypto';

// Sostituisce i placeholder {{chiave}} nel template con i valori forniti.
// Le chiavi non presenti in `vars` vengono sostituite con stringa vuota.
export function renderMailTemplate(template: string, vars: Record<string, string | undefined>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => vars[key] ?? '');
}

// Genera un token di disiscrizione firmato (HMAC) per email+cliente,
// verificabile da /api/mail-util?action=unsubscribe senza autenticazione utente.
export function buildUnsubscribeToken(email: string, clientId: string): string {
    const secret = process.env.MAIL_UNSUBSCRIBE_SECRET;
    if (!secret) throw new Error('MAIL_UNSUBSCRIBE_SECRET non configurato');
    const payload = `${email.toLowerCase()}|${clientId}`;
    const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
    return Buffer.from(`${payload}|${signature}`).toString('base64url');
}

export function verifyUnsubscribeToken(token: string): { email: string; clientId: string } | null {
    try {
        const decoded = Buffer.from(token, 'base64url').toString('utf-8');
        const [email, clientId, signature] = decoded.split('|');
        if (!email || !clientId || !signature) return null;

        const expected = buildUnsubscribeToken(email, clientId);
        const expectedSignature = Buffer.from(expected, 'base64url').toString('utf-8').split('|')[2];
        if (signature !== expectedSignature) return null;

        return { email, clientId };
    } catch {
        return null;
    }
}

export function buildUnsubscribeUrl(baseUrl: string, email: string, clientId: string): string {
    const token = buildUnsubscribeToken(email, clientId);
    return `${baseUrl}/api/mail-util?action=unsubscribe&token=${encodeURIComponent(token)}`;
}

// Header che migliorano la consegna: disiscrizione con un clic (RFC 8058, richiesta da Gmail/Yahoo
// per chi invia in volume) — l'handler unsubscribe accetta anche il POST del client di posta
export function buildMailHeaders(unsubscribeUrl: string): Record<string, string> {
    return {
        'List-Unsubscribe': `<${unsubscribeUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    };
}

const VALID_EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Reply-To configurato dal cliente (le risposte arrivano a lui invece che a noreply@)
export function getReplyTo(marketingSettings: any): string | undefined {
    const replyTo = String(marketingSettings?.reply_to_email || '').trim();
    return VALID_EMAIL_REGEX.test(replyTo) ? replyTo : undefined;
}

// Versione solo testo della mail: le mail solo-HTML risultano più "commerciali" ai filtri
export function htmlToText(html: string): string {
    return html
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<(head|style|script|title)[^>]*>[\s\S]*?<\/\1>/gi, '')
        .replace(/<a\s[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => {
            const text = label.replace(/<[^>]+>/g, '').trim();
            return text && text !== href ? `${text} (${href})` : href;
        })
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/(p|div|h[1-6]|tr|li|table)>/gi, '\n')
        .replace(/<li[^>]*>/gi, '- ')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, ' ')
        .replace(/ *\n */g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

export function buildTrackOpenUrl(baseUrl: string, recipientId: string): string {
    return `${baseUrl}/api/mail-util?action=track_open&rid=${encodeURIComponent(recipientId)}`;
}

export function buildTrackClickUrl(baseUrl: string, recipientId: string, targetUrl: string): string {
    return `${baseUrl}/api/mail-util?action=track_click&rid=${encodeURIComponent(recipientId)}&url=${encodeURIComponent(targetUrl)}`;
}

// Riscrive tutti gli href nel body HTML per il tracking click,
// e aggiunge il pixel di apertura alla fine del body.
export function injectTracking(html: string, baseUrl: string, recipientId: string): string {
    // Rewrite link (escludi disiscrizione e link vuoti/ancoraggio)
    const tracked = html.replace(
        /href="(https?:\/\/[^"]+)"/gi,
        (_match, url) => {
            if (url.includes('mail-util') && url.includes('unsubscribe')) return `href="${url}"`;
            return `href="${buildTrackClickUrl(baseUrl, recipientId, url)}"`;
        }
    );
    // Pixel apertura — funziona sia su HTML completo (con </body>) che su frammenti
    const pixel = `<img src="${buildTrackOpenUrl(baseUrl, recipientId)}" width="1" height="1" style="display:none" alt="" />`;
    if (/<\/body>/i.test(tracked)) {
        return tracked.replace(/<\/body>/i, `${pixel}</body>`);
    }
    return tracked + pixel;
}

// Copre "email", "e-mail", "E_mail" ma anche "mail" / "indirizzo_mail"
const EMAIL_KEY_REGEX = /mail/i;
// Stessa logica di src/lib/leadContact.ts: dal valore si estrae solo l'indirizzo
// ("mailto:mario@libero.it" → "mario@libero.it"), perché Resend rifiuta l'intero batch
// se anche un solo `to` non è nel formato standard.
const EMAIL_EXTRACT_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

export function extractEmail(value: unknown): string {
    const match = String(value ?? '').replace(/^\s*mailto:/i, '').match(EMAIL_EXTRACT_REGEX);
    return match ? match[0].replace(/^\.+|\.+$/g, '').toLowerCase() : '';
}

// Estrae l'email della lead cercando tra le chiavi del campo `data` (form dinamici).
// Fallback: primo valore che contiene un indirizzo email.
export function findLeadEmail(data: Record<string, string>): string | null {
    const entries = Object.entries(data || {}).map(([k, v]) => [k, extractEmail(v)] as const);
    const byKey = entries.find(([key, email]) => EMAIL_KEY_REGEX.test(key) && email);
    if (byKey) return byKey[1];
    const byValue = entries.find(([, email]) => email);
    return byValue ? byValue[1] : null;
}

export function findLeadName(data: Record<string, string>): string {
    for (const [key, value] of Object.entries(data || {})) {
        if (/nome|name/i.test(key) && value) return value.trim();
    }
    return '';
}
