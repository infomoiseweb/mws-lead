import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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
            const { appointment_date, appointment_time, duration_hours, title, notes, location_address } = appointment;
            const startDateTime = new Date(`${appointment_date}T${appointment_time}:00`);
            const endDateTime = new Date(startDateTime.getTime() + duration_hours * 60 * 60 * 1000);
            const event = {
                summary: title || 'Appuntamento',
                description: notes || '',
                location: location_address || '',
                start: { dateTime: startDateTime.toISOString(), timeZone: 'Europe/Rome' },
                end: { dateTime: endDateTime.toISOString(), timeZone: 'Europe/Rome' },
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
