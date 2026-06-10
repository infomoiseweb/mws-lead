import type { VercelRequest, VercelResponse } from '@vercel/node';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !user) {
        return res.status(401).json({ error: 'Token non valido o scaduto' });
    }

    const { to, subject, html, from, attachments } = req.body;
    if (!to || !subject || !html) {
        return res.status(400).json({ error: 'to, subject e html sono obbligatori' });
    }

    const { data, error } = await resend.emails.send({
        from: from || 'MWS Lead <noreply@mwslead.it>',
        to: Array.isArray(to) ? to : [to],
        subject,
        html,
        attachments,
    });

    if (error) {
        return res.status(500).json({ error: error.message });
    }

    return res.status(200).json({ success: true, id: data?.id });
}
