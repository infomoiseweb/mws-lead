import crypto from 'crypto';

// Sostituisce i placeholder {{chiave}} nel template con i valori forniti.
// Le chiavi non presenti in `vars` vengono sostituite con stringa vuota.
export function renderMailTemplate(template: string, vars: Record<string, string | undefined>): string {
    return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => vars[key] ?? '');
}

// Genera un token di disiscrizione firmato (HMAC) per email+cliente,
// verificabile da /api/mail-unsubscribe senza autenticazione utente.
export function buildUnsubscribeToken(email: string, clientId: string): string {
    const secret = process.env.MAIL_UNSUBSCRIBE_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
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
    return `${baseUrl}/api/mail-unsubscribe?token=${encodeURIComponent(token)}`;
}

const EMAIL_KEY_REGEX = /e[-_ ]?mail/i;

// Estrae l'email della lead cercando tra le chiavi del campo `data` (form dinamici).
export function findLeadEmail(data: Record<string, string>): string | null {
    for (const [key, value] of Object.entries(data || {})) {
        if (EMAIL_KEY_REGEX.test(key) && value && value.includes('@')) {
            return value.trim();
        }
    }
    return null;
}

export function findLeadName(data: Record<string, string>): string {
    for (const [key, value] of Object.entries(data || {})) {
        if (/nome|name/i.test(key) && value) return value.trim();
    }
    return '';
}
