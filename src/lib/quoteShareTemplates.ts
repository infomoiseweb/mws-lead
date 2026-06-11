export const DEFAULT_EMAIL_SUBJECT_TEMPLATE = 'Preventivo n. {{numero}} — {{azienda}}';
export const DEFAULT_EMAIL_BODY_TEMPLATE = 'Ciao {{nome}},\n\nin allegato trovi il preventivo n. {{numero}}.\n\n{{link_pdf}}\n\n{{azienda}}';
export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = 'Ciao {{nome}}, ecco il preventivo n. {{numero}}. {{link_pdf}}';

export interface QuoteShareTemplateVars {
    nome: string;
    numero: string;
    azienda: string;
    link_pdf: string;
}

// Sostituisce i placeholder {{nome}}, {{numero}}, {{azienda}}, {{link_pdf}} e ripulisce
// le righe vuote in eccesso lasciate da {{link_pdf}} quando il link non è incluso.
export function applyQuoteShareTemplate(template: string, vars: QuoteShareTemplateVars): string {
    let result = template;
    for (const [key, value] of Object.entries(vars)) {
        result = result.split(`{{${key}}}`).join(value);
    }
    return result.replace(/\n{3,}/g, '\n\n').trim();
}
