import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
const CLIENT_SECRET = process.env.GOOGLE_CALENDAR_CLIENT_SECRET!;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const BASE_URL = 'https://www.mws-saas.com';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code, state: rawState, error } = req.query;

    // Decodifica state: "clientId:redirectTo"
    const [clientId, redirectTo] = (rawState as string || '').split(':');
    const isClientRedirect = redirectTo === 'client';

    const errorRedirect = async (msg: string) => {
        if (isClientRedirect) {
            // Recupera user_id per costruire URL dashboard cliente
            const { data } = await supabaseAdmin.from('clients').select('user_id').eq('id', clientId).single();
            const userId = data?.user_id;
            if (userId) return res.redirect(`${BASE_URL}/client/${userId}/dashboard?view=integrazioni&gcal_error=${msg}`);
        }
        return res.redirect(`${BASE_URL}/admin?gcal_error=${msg}`);
    };

    if (error) return errorRedirect(error as string);
    if (!code || !clientId) return res.status(400).send('Parametri mancanti');

    // Scambia il code con i token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            code: code as string,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            redirect_uri: REDIRECT_URI,
            grant_type: 'authorization_code',
        }),
    });

    const tokens = await tokenRes.json();

    if (!tokenRes.ok || !tokens.access_token) return errorRedirect('token_exchange_failed');

    const expiry = Date.now() + (tokens.expires_in || 3600) * 1000;

    const { data: clientData, error: dbError } = await supabaseAdmin
        .from('clients')
        .update({
            google_access_token: tokens.access_token,
            google_refresh_token: tokens.refresh_token || null,
            google_token_expiry: expiry,
            google_calendar_enabled: true,
        })
        .eq('id', clientId)
        .select('user_id')
        .single();

    if (dbError) return errorRedirect('db_save_failed');

    if (isClientRedirect && clientData?.user_id) {
        return res.redirect(`${BASE_URL}/client/${clientData.user_id}/dashboard?view=integrazioni&gcal_success=1`);
    }
    res.redirect(`${BASE_URL}/admin?gcal_success=${clientId}`);
}
