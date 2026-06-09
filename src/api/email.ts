import { supabase } from '../lib/supabase';

// Chiama la Vercel API Route /api/send-email
// Usa il JWT di Supabase per autenticarsi — nessuna password manuale
async function sendEmail(payload: { to: string | string[]; subject: string; html: string }): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('Utente non autenticato.');

    const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Errore sconosciuto' }));
        throw new Error(err.error || `HTTP ${res.status}`);
    }
}

// ─── Template email ────────────────────────────────────────────────────────────

export async function sendNewLeadNotification(params: {
    clientEmail: string;
    clientName: string;
    leadName: string;
    service?: string;
    dashboardUrl: string;
}): Promise<void> {
    await sendEmail({
        to: params.clientEmail,
        subject: `🔔 Nuovo lead ricevuto — ${params.leadName}`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
                <h2 style="color: #111827; margin-bottom: 8px;">Nuovo lead ricevuto!</h2>
                <p style="color: #374151;">Ciao <strong>${params.clientName}</strong>,</p>
                <p style="color: #374151;">
                    Hai ricevuto un nuovo lead: <strong>${params.leadName}</strong>
                    ${params.service ? `per il servizio <strong>${params.service}</strong>` : ''}.
                </p>
                <a href="${params.dashboardUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Vai alla dashboard →
                </a>
                <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">MWS Lead Manager</p>
            </div>
        `,
    });
}

export async function sendQuoteToClient(params: {
    recipientEmail: string;
    recipientName: string;
    quoteNumber: string;
    totalAmount: number;
    quoteHtml: string;
}): Promise<void> {
    await sendEmail({
        to: params.recipientEmail,
        subject: `Preventivo ${params.quoteNumber} — €${params.totalAmount.toFixed(2)}`,
        html: params.quoteHtml,
    });
}

export async function sendCustomNotificationEmail(params: {
    to: string | string[];
    title: string;
    message: string;
}): Promise<void> {
    await sendEmail({
        to: params.to,
        subject: params.title,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
                <h2 style="color: #111827;">${params.title}</h2>
                <p style="color: #374151; line-height: 1.6;">${params.message}</p>
                <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">MWS Lead Manager</p>
            </div>
        `,
    });
}

export async function sendWelcomeEmail(params: {
    clientEmail: string;
    clientName: string;
    dashboardUrl: string;
}): Promise<void> {
    await sendEmail({
        to: params.clientEmail,
        subject: `Benvenuto su MWS Lead Manager!`,
        html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #f9fafb; border-radius: 8px;">
                <h2 style="color: #111827;">Benvenuto, ${params.clientName}! 👋</h2>
                <p style="color: #374151;">Il tuo account è stato creato. Da adesso puoi accedere alla tua dashboard per gestire le lead delle tue campagne pubblicitarie.</p>
                <a href="${params.dashboardUrl}" style="display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2563eb; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">
                    Accedi alla dashboard →
                </a>
                <p style="margin-top: 24px; color: #9ca3af; font-size: 12px;">MWS Lead Manager</p>
            </div>
        `,
    });
}
