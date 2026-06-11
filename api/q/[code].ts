import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    const { code } = req.query;
    if (typeof code !== 'string') {
        return res.status(400).json({ error: 'Link non valido' });
    }

    const { data: link } = await supabaseAdmin
        .from('quote_share_links')
        .select('client_id, quote_id')
        .eq('code', code)
        .maybeSingle();

    if (!link) {
        return res.status(404).send('Link non trovato.');
    }

    const pdfUrl = `${process.env.VITE_SUPABASE_URL}/storage/v1/object/public/quote-pdfs/${link.client_id}/${link.quote_id}.pdf`;
    res.writeHead(302, { Location: pdfUrl });
    res.end();
}
