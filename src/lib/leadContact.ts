// I form dei clienti chiamano il campo in modi diversi ("email", "Email", "mail", "e-mail"...).
// Stessa logica di findLeadEmail lato server (api/_lib/mailRender.ts): prima una chiave che
// contiene "mail" con un valore valido, poi qualsiasi valore che abbia la forma di un'email.
const EMAIL_VALUE_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function findLeadEmail(data: Record<string, unknown> | null | undefined): string {
    const entries = Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '').trim()] as const);
    const byKey = entries.find(([key, value]) => /mail/i.test(key) && EMAIL_VALUE_REGEX.test(value));
    if (byKey) return byKey[1];
    return entries.find(([, value]) => EMAIL_VALUE_REGEX.test(value))?.[1] || '';
}

// Telefono: "telefono", "Telefono", "phone", "numero_di_telefono", "cellulare", "whatsapp"...
// Il valore deve contenere almeno 6 cifre per escludere risposte non numeriche.
const PHONE_KEY_REGEX = /tel|phone|cell|whats/i;

export function findLeadPhone(data: Record<string, unknown> | null | undefined): string {
    const entries = Object.entries(data || {}).map(([k, v]) => [k, String(v ?? '').trim()] as const);
    return entries.find(([key, value]) => PHONE_KEY_REGEX.test(key) && (value.match(/\d/g) || []).length >= 6)?.[1] || '';
}
