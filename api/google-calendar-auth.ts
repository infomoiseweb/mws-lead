import type { VercelRequest, VercelResponse } from '@vercel/node';

const CLIENT_ID = process.env.GOOGLE_CALENDAR_CLIENT_ID!;
const REDIRECT_URI = process.env.GOOGLE_CALENDAR_REDIRECT_URI!;

const SCOPES = [
    'https://www.googleapis.com/auth/calendar.events',
].join(' ');

export default function handler(req: VercelRequest, res: VercelResponse) {
    const clientId = req.query.client_id as string;
    const redirectTo = (req.query.redirect_to as string) || 'admin'; // 'admin' | 'client'
    if (!clientId) return res.status(400).json({ error: 'client_id mancante' });

    // Codifica redirectTo nello state insieme al clientId
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

    res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
}
