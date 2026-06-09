import { createClient } from '@supabase/supabase-js';

// Usa service_role per creare utenti Auth server-side
const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: Request): Promise<Response> {
    if (req.method !== 'POST') {
        return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // Verifica che sia un admin autenticato
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user: requester }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
    if (authError || !requester) {
        return new Response(JSON.stringify({ error: 'Token non valido' }), { status: 401 });
    }

    // Verifica che sia admin
    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role')
        .eq('id', requester.id)
        .single();

    if (profile?.role !== 'admin') {
        return new Response(JSON.stringify({ error: 'Solo gli admin possono creare clienti' }), { status: 403 });
    }

    const { name, username, email, password, services, quote_webhook_url } = await req.json();

    if (!name || !email || !password || !services) {
        return new Response(JSON.stringify({ error: 'name, email, password e services sono obbligatori' }), { status: 400 });
    }

    // 1. Crea utente in Supabase Auth
    const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // conferma email automatica
        user_metadata: { username: username || email, role: 'client' },
    });

    if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400 });
    }

    const userId = authData.user.id;

    // 2. Il trigger handle_new_user() crea il profilo in public.users automaticamente
    // Aggiorniamo username e role per sicurezza
    await supabaseAdmin
        .from('users')
        .update({ username: username || email, role: 'client', status: 'active' })
        .eq('id', userId);

    // 3. Crea il client record con i servizi
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
        // Rollback: elimina l'utente Auth se la creazione del client fallisce
        await supabaseAdmin.auth.admin.deleteUser(userId);
        return new Response(JSON.stringify({ error: clientError.message }), { status: 500 });
    }

    return new Response(JSON.stringify({
        success: true,
        client: { ...newClient, leads: [], adSpends: [], services: servicesWithIds }
    }), { status: 201 });
}
