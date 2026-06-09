import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const resend = new Resend(process.env.RESEND_API_KEY);

// Client Supabase con la service_role key — può verificare JWT senza RLS
const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // Verifica il JWT di Supabase — chi non è loggato non può mandare email
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(jwt);

    if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Token non valido o scaduto' }), { status: 401 });
    }

    let payload: { to: string | string[]; subject: string; html: string; from?: string };
    try {
        payload = await req.json();
    } catch {
        return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 });
    }

    const { to, subject, html, from } = payload;
    if (!to || !subject || !html) {
        return new Response(JSON.stringify({ error: 'to, subject e html sono obbligatori' }), { status: 400 });
    }

    try {
        const { data, error } = await resend.emails.send({
            from: from || 'MWS Lead <noreply@mwslead.it>',
            to: Array.isArray(to) ? to : [to],
            subject,
            html,
        });

        if (error) {
            console.error('Resend error:', error);
            return new Response(JSON.stringify({ error: error.message }), { status: 500 });
        }

        return new Response(JSON.stringify({ success: true, id: data?.id }), { status: 200 });
    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
