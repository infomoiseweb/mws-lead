import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const APP_ID = process.env.META_APP_ID!;
const APP_SECRET = process.env.META_APP_SECRET!;
const REDIRECT_URI = process.env.META_REDIRECT_URI!; // https://mws-saas.com/api/meta
const BASE_URL = 'https://www.mws-saas.com';
const SCOPES = 'pages_show_list,pages_read_engagement,pages_manage_posts,instagram_basic,instagram_content_publish';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getLongLivedToken(shortToken: string): Promise<{ token: string; expiry: number }> {
    const url = `https://graph.facebook.com/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`;
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok || !data.access_token) throw new Error(data.error?.message || 'Token exchange fallito');
    const expiry = Date.now() + (data.expires_in || 5184000) * 1000;
    return { token: data.access_token, expiry };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {

    // ── GET con ?code → callback OAuth ──────────────────────────────────────
    if (req.method === 'GET' && req.query.code) {
        const { code, state: rawState, error } = req.query;
        const [clientId, redirectTo] = (rawState as string || '').split(':');
        const isClientRedirect = redirectTo === 'client';

        const errorRedirect = async (msg: string) => {
            if (isClientRedirect) {
                const { data } = await supabaseAdmin.from('clients').select('user_id').eq('id', clientId).single();
                const userId = data?.user_id;
                if (userId) return res.redirect(`${BASE_URL}/client/${userId}/dashboard?view=integrazioni&meta_error=${encodeURIComponent(msg)}`);
            }
            return res.redirect(`${BASE_URL}/admin?meta_error=${encodeURIComponent(msg)}`);
        };

        if (error) return errorRedirect(error as string);
        if (!code || !clientId) return res.status(400).send('Parametri mancanti');

        try {
            // Scambia code con short-lived token
            const tokenUrl = `https://graph.facebook.com/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`;
            const tokenRes = await fetch(tokenUrl);
            const tokenData = await tokenRes.json();
            if (!tokenRes.ok || !tokenData.access_token) return errorRedirect('token_exchange_failed');

            // Converte in long-lived token (60 giorni)
            const { token: longToken, expiry } = await getLongLivedToken(tokenData.access_token);

            // Recupera le Page Facebook collegate (per publishing)
            const pagesRes = await fetch(`https://graph.facebook.com/me/accounts?access_token=${longToken}`);
            const pagesData = await pagesRes.json();

            await supabaseAdmin.from('clients').update({
                meta_access_token: longToken,
                meta_token_expiry: expiry,
                meta_pages: pagesData.data || [],
                meta_enabled: true,
            }).eq('id', clientId);

            if (isClientRedirect) {
                const { data } = await supabaseAdmin.from('clients').select('user_id').eq('id', clientId).single();
                if (data?.user_id) return res.redirect(`${BASE_URL}/client/${data.user_id}/dashboard?view=integrazioni&meta_success=1`);
            }
            return res.redirect(`${BASE_URL}/admin?meta_success=${clientId}`);
        } catch (e: any) {
            return errorRedirect(e.message);
        }
    }

    // ── GET senza ?code → avvia flusso OAuth ────────────────────────────────
    if (req.method === 'GET') {
        const clientId = req.query.client_id as string;
        const redirectTo = (req.query.redirect_to as string) || 'admin';
        if (!clientId) return res.status(400).json({ error: 'client_id mancante' });

        const state = `${clientId}:${redirectTo}`;
        const params = new URLSearchParams({
            client_id: APP_ID,
            redirect_uri: REDIRECT_URI,
            scope: SCOPES,
            response_type: 'code',
            state,
        });
        return res.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params.toString()}`);
    }

    // ── POST → pubblica contenuto ────────────────────────────────────────────
    if (req.method === 'POST') {
        const authHeader = req.headers.authorization;
        const token = authHeader?.replace('Bearer ', '').trim();
        if (!token) return res.status(401).json({ error: 'Token mancante' });

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) return res.status(401).json({ error: 'Non autorizzato' });

        const { action, client_id, page_id, message, image_url, instagram_account_id } = req.body;
        if (!client_id) return res.status(400).json({ error: 'client_id mancante' });

        const { data: clientData } = await supabaseAdmin
            .from('clients')
            .select('meta_access_token, meta_token_expiry, meta_pages')
            .eq('id', client_id)
            .single();

        if (!clientData?.meta_access_token) return res.status(400).json({ error: 'Meta non collegato' });

        // Controlla scadenza token (avvisa se < 7 giorni)
        const daysLeft = (clientData.meta_token_expiry - Date.now()) / (1000 * 60 * 60 * 24);
        if (daysLeft < 0) return res.status(401).json({ error: 'Token Meta scaduto — ricollegare l\'account' });

        try {
            // Recupera page access token dalla lista pagine salvate
            const pages: any[] = clientData.meta_pages || [];
            const page = page_id ? pages.find(p => p.id === page_id) : pages[0];
            if (!page) return res.status(400).json({ error: 'Nessuna pagina Facebook trovata' });

            const pageToken = page.access_token;

            if (action === 'post_facebook') {
                const body: any = { message, access_token: pageToken };
                if (image_url) body.url = image_url;
                const endpoint = image_url
                    ? `https://graph.facebook.com/${page.id}/photos`
                    : `https://graph.facebook.com/${page.id}/feed`;
                const fbRes = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });
                const fbData = await fbRes.json();
                if (!fbRes.ok) throw new Error(fbData.error?.message || 'Errore Facebook');
                return res.status(200).json({ success: true, post_id: fbData.id });
            }

            if (action === 'post_instagram') {
                if (!instagram_account_id) return res.status(400).json({ error: 'instagram_account_id mancante' });
                if (!image_url) return res.status(400).json({ error: 'image_url obbligatoria per Instagram' });

                // Step 1: crea container media
                const containerRes = await fetch(`https://graph.facebook.com/${instagram_account_id}/media`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_url, caption: message, access_token: pageToken }),
                });
                const containerData = await containerRes.json();
                if (!containerRes.ok) throw new Error(containerData.error?.message || 'Errore creazione container Instagram');

                // Step 2: pubblica container
                const publishRes = await fetch(`https://graph.facebook.com/${instagram_account_id}/media_publish`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ creation_id: containerData.id, access_token: pageToken }),
                });
                const publishData = await publishRes.json();
                if (!publishRes.ok) throw new Error(publishData.error?.message || 'Errore pubblicazione Instagram');
                return res.status(200).json({ success: true, post_id: publishData.id });
            }

            if (action === 'get_pages') {
                return res.status(200).json({ success: true, pages, days_left: Math.floor(daysLeft) });
            }

            return res.status(400).json({ error: 'action non valida' });
        } catch (e: any) {
            return res.status(500).json({ error: e.message });
        }
    }

    return res.status(405).json({ error: 'Metodo non consentito' });
}
