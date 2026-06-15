import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { verifyUnsubscribeToken } from './_lib/mailRender';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function page(message: string): string {
    return `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Disiscrizione</title>
    <style>
        body { font-family: Arial, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f9fafb; color: #111827; }
        .card { max-width: 420px; padding: 32px; background: #fff; border-radius: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); text-align: center; }
    </style>
</head>
<body>
    <div class="card"><p>${message}</p></div>
</body>
</html>`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { token } = req.query;
    if (typeof token !== 'string') {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send(page('Link non valido.'));
    }

    const decoded = verifyUnsubscribeToken(token);
    if (!decoded) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(400).send(page('Link non valido o scaduto.'));
    }

    const { error } = await supabaseAdmin
        .from('mail_unsubscribes')
        .upsert({ client_id: decoded.clientId, email: decoded.email.toLowerCase() }, { onConflict: 'client_id,email' });

    if (error) {
        res.setHeader('Content-Type', 'text/html');
        return res.status(500).send(page('Si è verificato un errore. Riprova più tardi.'));
    }

    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(page(`L'indirizzo ${decoded.email} è stato rimosso dalle comunicazioni di marketing.`));
}
