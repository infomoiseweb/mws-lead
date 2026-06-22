import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).end();

    const { olat, olng, dlat, dlng } = req.query;
    if (!olat || !olng || !dlat || !dlng) return res.status(400).json({ error: 'Missing params' });

    const key = process.env.GOOGLE_MAPS_API_KEY;
    if (!key) return res.status(500).json({ error: 'API key not configured' });

    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${olat},${olng}&destinations=${dlat},${dlng}&mode=driving&units=metric&region=it&language=it&key=${key}`;

    try {
        const gRes = await fetch(url);
        const data = await gRes.json() as any;
        const element = data?.rows?.[0]?.elements?.[0];
        if (element?.status !== 'OK') return res.status(200).json({ km: null });
        res.status(200).json({ km: element.distance.value / 1000 });
    } catch {
        res.status(500).json({ error: 'Failed to fetch distance' });
    }
}
