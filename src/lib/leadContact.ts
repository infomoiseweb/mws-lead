// I form dei clienti chiamano il campo in modi diversi ("email", "Email", "mail", "e-mail"...).
// Stessa logica di findLeadEmail lato server (api/_lib/mailRender.ts): prima una chiave che
// contiene "mail" con un valore valido, poi qualsiasi valore che contenga un'email.
// Dal valore si estrae solo l'indirizzo: "mailto:mario@libero.it" o " Mario@Libero.it " → "mario@libero.it"
// (Resend rifiuta l'intero batch se un indirizzo non è nel formato standard).
const EMAIL_EXTRACT_REGEX = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/;

export function extractEmail(value: unknown): string {
    const match = String(value ?? '').replace(/^\s*mailto:/i, '').match(EMAIL_EXTRACT_REGEX);
    return match ? match[0].replace(/^\.+|\.+$/g, '').toLowerCase() : '';
}

export function findLeadEmail(data: Record<string, unknown> | null | undefined): string {
    const entries = Object.entries(data || {}).map(([k, v]) => [k, extractEmail(v)] as const);
    const byKey = entries.find(([key, email]) => /mail/i.test(key) && email);
    if (byKey) return byKey[1];
    return entries.find(([, email]) => email)?.[1] || '';
}

// Telefono: "telefono", "Telefono", "phone", "numero_di_telefono", "cellulare", "whatsapp"...
// Il valore deve contenere almeno 6 cifre per escludere risposte non numeriche.
const PHONE_KEY_REGEX = /tel|phone|cell|whats/i;

export function findLeadPhone(data: Record<string, unknown> | null | undefined): string {
    const entries = Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '').trim()] as const);
    return entries.find(([key, value]) => PHONE_KEY_REGEX.test(key) && (value.match(/\d/g) || []).length >= 6)?.[1] || '';
}
