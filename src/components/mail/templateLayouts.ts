// Layout di partenza per i template di Mail Marketing.
// I placeholder vengono sostituiti con i dati di branding del cliente e i dati della lead
// al momento dell'invio (vedi api/_lib/mailRender.ts) e in anteprima nell'editor.

export const STARTER_TEMPLATES: Record<'simple' | 'image_header' | 'newsletter', { subject: string; body: string }> = {
    simple: {
        subject: 'Una novità da {{brand_name}}',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: {{secondary_color}}; padding: 24px; text-align: center;">
    <h1 style="color: #ffffff; margin: 0; font-size: 20px;">{{brand_name}}</h1>
  </div>
  <div style="padding: 24px; background: #ffffff; color: #111827;">
    <p>Ciao {{nome}},</p>
    <p>Scrivi qui il contenuto della tua email...</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="#" style="background: {{primary_color}}; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Scopri di più</a>
    </p>
  </div>
  <div style="padding: 16px; background: #f3f4f6; color: #6b7280; font-size: 12px; text-align: center;">
    {{footer_text}}<br/>
    <a href="{{unsubscribe_link}}" style="color: #6b7280;">Annulla l'iscrizione</a>
  </div>
</div>`,
    },
    image_header: {
        subject: '{{brand_name}}: ecco le novità per te',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="text-align: center; padding: 24px 0; background: #ffffff;">
    <img src="{{logo_url}}" alt="{{brand_name}}" style="max-height: 60px;" />
  </div>
  <div style="padding: 0 24px 24px; background: #ffffff; color: #111827;">
    <h2 style="color: {{primary_color}}; margin-top: 0;">Titolo della campagna</h2>
    <p>Ciao {{nome}},</p>
    <p>Scrivi qui il contenuto della tua email...</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="#" style="background: {{primary_color}}; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Scopri di più</a>
    </p>
  </div>
  <div style="padding: 16px; background: #f3f4f6; color: #6b7280; font-size: 12px; text-align: center;">
    {{footer_text}}<br/>
    <a href="{{unsubscribe_link}}" style="color: #6b7280;">Annulla l'iscrizione</a>
  </div>
</div>`,
    },
    newsletter: {
        subject: 'La newsletter di {{brand_name}}',
        body: `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <div style="background: {{secondary_color}}; padding: 24px; text-align: center;">
    <img src="{{logo_url}}" alt="{{brand_name}}" style="max-height: 48px;" />
  </div>
  <div style="padding: 24px; background: #ffffff; color: #111827;">
    <p>Ciao {{nome}},</p>
    <h2 style="color: {{primary_color}};">Novità #1</h2>
    <p>Scrivi qui il contenuto della prima novità...</p>
    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
    <h2 style="color: {{primary_color}};">Novità #2</h2>
    <p>Scrivi qui il contenuto della seconda novità...</p>
    <p style="text-align: center; margin: 24px 0;">
      <a href="#" style="background: {{primary_color}}; color: #ffffff; padding: 10px 20px; border-radius: 6px; text-decoration: none; display: inline-block;">Scopri di più</a>
    </p>
  </div>
  <div style="padding: 16px; background: #f3f4f6; color: #6b7280; font-size: 12px; text-align: center;">
    {{footer_text}}<br/>
    <a href="{{unsubscribe_link}}" style="color: #6b7280;">Annulla l'iscrizione</a>
  </div>
</div>`,
    },
};

export const LAYOUT_LABELS: Record<'simple' | 'image_header' | 'newsletter', string> = {
    simple: 'Semplice',
    image_header: 'Intestazione con logo',
    newsletter: 'Newsletter (più sezioni)',
};

// Sostituzione placeholder lato client, per l'anteprima nell'editor.
export function renderPreview(html: string, vars: Record<string, string | undefined>): string {
    return html.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, key) => vars[key] ?? '');
}
