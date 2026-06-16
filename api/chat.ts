import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI } from '@google/genai';

const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    // Verifica JWT utente
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return res.status(401).json({ error: 'Unauthorized' });
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { message, history, systemInstruction } = req.body as {
        message: string;
        history: { role: string; parts: { text: string }[] }[];
        systemInstruction?: string;
    };

    if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Missing message' });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'AI service not configured' });

    const ai = new GoogleGenAI({ apiKey });
    const chat = ai.chats.create({
        model: 'gemini-2.5-flash',
        history: (history || []).filter(m => m.parts?.[0]?.text?.trim()),
        config: systemInstruction ? { systemInstruction } : undefined,
    });

    const response = await chat.sendMessage({ message });
    const text = response.text ?? '';

    return res.status(200).json({ text });
}
