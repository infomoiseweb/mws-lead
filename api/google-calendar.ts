import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function extractLeadField(data: Record<string, string>, keys: string[]): string {
    for (const key of keys) {
        const entry = Object.entries(data).find(([k]) => k.toLowerCase().replace(/[\s_-]/g, '') === key.replace(/[\s_-]/g, ''));
        if (entry?.[1]?.trim()) return entry[1].trim();
    }
    return '';
}

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;
const SCOPES = 'https://www.googleapis.com/auth/calendar.events';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expiry: number }> {
    const res = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            refresh_token: refreshToken,
            grant_type: 'refresh_token',
        }),
    });
    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error('Refresh token fallito');
    return { access_token: data.access_token, expiry: Date.now() + (data.expires_in || 3600) * 1000 };
}

async function getValidToken(clientId: string): Promise<string> {
    const { data: client, error } = await supabaseAdmin
        .from('clients')
        .select('google_access_token, google_refresh_token, google_token_expiry')
        .eq('id', clientId)
        .single();

    if (error || !client?.google_access_token) throw new Error('Token Google non trovato');

    if (client.google_token_expiry && Date.now() > client.google_token_expiry - 5 * 60 * 1000) {
        if (!client.google_refresh_token) throw new Error('Refresh token mancante');
        const { access_token, expiry } = await refreshAccessToken(client.google_refresh_token);
        await supabaseAdmin.from('clients').update({ google_access_token: access_token, google_token_expiry: expiry }).eq('id', clientId);
        return access_token;
    }

    return client.google_access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    // GET → avvia flusso OAuth (ex google-calendar-auth.ts)
    if (req.method === 'GET') {
        const clientId = req.query.client_id as string;
        const redirectTo = (req.query.redirect_to as string) || 'admin';
        if (!clientId) return res.status(400).json({ error: 'client_id mancante' });

        const state = `${clientId}:${redirectTo}`;
        const params = new URLSearchParams({
            client_id: CLIENT_ID,
            redirect_uri: REDIRECT_URI,
            response_type: 'code',
            scope: SCOPES,
            access_type: 'offline',
            prompt: 'consent',
            state,
        });
        return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
    }

    // POST → crea/aggiorna/elimina evento (ex google-calendar-event.ts)
    const authHeader = req.headers.authorization;
    const token = authHeader?.replace('Bearer ', '').trim();
    if (!token) return res.status(401).json({ error: 'Token mancante' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Non autorizzato' });

    const { action, client_id, appointment_id, appointment } = req.body;
    if (!client_id) return res.status(400).json({ error: 'client_id mancante' });

    try {
        const accessToken = await getValidToken(client_id);
        const { data: clientData } = await supabaseAdmin.from('clients').select('google_calendar_id').eq('id', client_id).single();
        const calendarId = clientData?.google_calendar_id || 'primary';

        if (action === 'create' || action === 'update') {
            const { appointment_date, appointment_time, duration_hours, title, notes, location_address, lead_data, lead_service } = appointment;
            // Calcola data/ora di fine sommando la durata in minuti, gestendo l'overflow di giorno.
            // Le stringhe vengono passate a Google senza suffisso Z: l'istante viene così interpretato
            // nel fuso indicato da timeZone (Europe/Rome) invece di subire un doppio offset.
            const [startHour, startMinute] = appointment_time.split(':').map(Number);
            const [y, m, d] = appointment_date.split('-').map(Number);
            const endDateObj = new Date(y, m - 1, d, startHour, startMinute);
            endDateObj.setMinutes(endDateObj.getMinutes() + duration_hours * 60);
            const pad = (n: number) => String(n).padStart(2, '0');
            const endDateStr = `${endDateObj.getFullYear()}-${pad(endDateObj.getMonth() + 1)}-${pad(endDateObj.getDate())}`;
            const endTimeStr = `${pad(endDateObj.getHours())}:${pad(endDateObj.getMinutes())}`;
            const startDateTimeStr = `${appointment_date}T${appointment_time}:00`;
            const endDateTimeStr = `${endDateStr}T${endTimeStr}:00`;

            // Estrai info del lead per titolo e descrizione
            const leadName = lead_data ? extractLeadField(lead_data, ['nome', 'name', 'nome_cognome', 'full_name', 'nominativo']) : '';
            const leadPhone = lead_data ? extractLeadField(lead_data, ['telefono', 'phone', 'tel', 'cellulare', 'mobile', 'numero']) : '';
            const leadEmail = lead_data ? extractLeadField(lead_data, ['email', 'mail', 'e-mail']) : '';

            const summary = leadName || title || 'Appuntamento';

            const descParts: string[] = [];
            if (leadName) descParts.push(`👤 Cliente: ${leadName}`);
            if (leadPhone) descParts.push(`📞 Telefono: ${leadPhone}`);
            if (leadEmail) descParts.push(`✉️ Email: ${leadEmail}`);
            if (lead_service) descParts.push(`🏷️ Servizio: ${lead_service}`);
            if (notes) descParts.push(`📝 Note: ${notes}`);

            const event = {
                summary,
                description: descParts.join('\n'),
                location: location_address || '',
                start: { dateTime: startDateTimeStr, timeZone: 'Europe/Rome' },
                end: { dateTime: endDateTimeStr, timeZone: 'Europe/Rome' },
            };

            if (action === 'create') {
                const gcalRes = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
                    { method: 'POST', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) }
                );
                const gcalData = await gcalRes.json();
                if (!gcalRes.ok) throw new Error(gcalData.error?.message || 'Errore Google Calendar');
                await supabaseAdmin.from('appointments').update({ google_event_id: gcalData.id }).eq('id', appointment_id);
                return res.status(200).json({ success: true, event_id: gcalData.id });
            } else {
                const { data: appt } = await supabaseAdmin.from('appointments').select('google_event_id').eq('id', appointment_id).single();
                if (!appt?.google_event_id) return res.status(200).json({ success: false, reason: 'no_event_id' });
                const gcalRes = await fetch(
                    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appt.google_event_id}`,
                    { method: 'PUT', headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(event) }
                );
                if (!gcalRes.ok) { const err = await gcalRes.json(); throw new Error(err.error?.message || 'Errore aggiornamento'); }
                return res.status(200).json({ success: true });
            }
        } else if (action === 'delete') {
            const { data: appt } = await supabaseAdmin.from('appointments').select('google_event_id').eq('id', appointment_id).single();
            if (!appt?.google_event_id) return res.status(200).json({ success: false, reason: 'no_event_id' });
            await fetch(
                `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${appt.google_event_id}`,
                { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
            );
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'action non valida' });
    } catch (e: any) {
        return res.status(500).json({ error: e.message });
    }
}
