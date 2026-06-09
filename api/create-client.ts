import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    if (!process.env.VITE_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
        return res.status(500).json({ error: 'Variabili d\'ambiente mancanti su Vercel' });
    }

    // Verifica JWT admin
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized' });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !requester) {
        return res.status(401).json({ error: 'Token non valido' });
    }

    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', requester.id)
        .single();

    if (profile?.role !== 'admin') {
        return res.status(403).json({ error: 'Solo gli admin possono creare clienti' });
    }

    const { name, username, email, password, services, quote_webhook_url } = req.body;

    if (!name || !email || !password || !services) {
        return res.status(400).json({ error: 'name, email, password e services sono obbligatori' });
    }

    // Crea utente in Supabase Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { username: username || email, role: 'client' },
    });

    if (createError) {
        return res.status(400).json({ error: createError.message });
    }

    const userId = authData.user.id;

    await supabaseAdmin
        .from('users')
        .update({ username: username || email, role: 'client', status: 'active' })
        .eq('id', userId);

    const servicesWithIds = services.map((s: any) => ({
        ...s,
        id: `service_${Date.now()}_${Math.random()}`,
        fields: s.fields.map((f: any) => ({ ...f, id: `field_${Date.now()}_${Math.random()}` })),
    }));

    const { data: newClient, error: clientError } = await supabaseAdmin
        .from('clients')
        .insert({ name, user_id: userId, services: servicesWithIds, quote_webhook_url: quote_webhook_url || null })
        .select()
        .single();

    if (clientError) {
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return res.status(500).json({ error: clientError.message });
    }

    return res.status(201).json({
        success: true,
        client: { ...newClient, leads: [], adSpends: [], services: servicesWithIds }
    });
}
