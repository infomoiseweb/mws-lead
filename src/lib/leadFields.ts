// Cerca un valore email/telefono nei dati di una lead, indipendentemente
// da come il cliente ha chiamato il campo nel proprio form.
const EMAIL_KEY_PATTERN = /e[-_ ]?mail/i;
const PHONE_KEY_PATTERN = /telefono|cellulare|cell|phone|tel\b/i;

export function findLeadEmail(data: Record<string, any> | undefined): string {
    if (!data) return '';
    for (const [key, value] of Object.entries(data)) {
        if (EMAIL_KEY_PATTERN.test(key) && typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

export function findLeadPhone(data: Record<string, any> | undefined): string {
    if (!data) return '';
    for (const [key, value] of Object.entries(data)) {
        if (PHONE_KEY_PATTERN.test(key) && typeof value === 'string' && value.trim()) {
            return value.trim();
        }
    }
    return '';
}

// Normalizza un numero di telefono per l'uso in un link wa.me (formato internazionale senza +)
export function normalizePhoneForWhatsApp(phone: string | undefined): string {
    if (!phone) return '';
    let normalized = phone.replace(/[\s-()]/g, '');
    if (normalized.startsWith('+')) normalized = normalized.substring(1);
    else if (normalized.startsWith('00')) normalized = normalized.substring(2);

    if (normalized.length >= 9 && normalized.length <= 11 && !normalized.startsWith('39')) {
        normalized = `39${normalized}`;
    }
    return normalized;
}
