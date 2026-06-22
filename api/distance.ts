import type { VercelRequest, VercelResponse } from '@vercel/node';

const KEY = process.env.GOOGLE_MAPS_API_KEY;

function withItaly(s: string) {
    return /italia|italy/i.test(s) ? s : `${s}, Italia`;
}

function normalizeAddress(raw: string): string {
    return raw
        .trim()
        .replace(/\s*[–—-]\s*/g, ', ')
        .replace(/[^\w\s,.'àáèéìíòóùú]/gi, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function looksLikeCityOnly(s: string): boolean {
    return !/\d/.test(s) && !/\b(via|viale|piazza|corso|strada|loc\.|fraz\.)\b/i.test(s);
}

function addressVariants(normalized: string): string[] {
    const variants: string[] = [withItaly(normalized)];
    if (looksLikeCityOnly(normalized)) {
        variants.push(withItaly(`${normalized} centro`));
    }
    const parts = normalized.split(',').map(p => p.trim()).filter(Boolean);
    if (parts.length > 1) {
        variants.push(withItaly(parts[0]));
        variants.push(withItaly(`${parts[0]} centro`));
        variants.push(withItaly(parts[parts.length - 1]));
        variants.push(withItaly([...parts].reverse().join(', ')));
    } else {
        const words = normalized.trim().split(/\s+/);
        if (words.length >= 2) {
            variants.push(withItaly(`${words[0]}, ${words.slice(1).join(' ')}`));
            variants.push(withItaly(`${words.slice(1).join(' ')}, ${words[0]}`));
            variants.push(withItaly(`${words.slice(1).join(' ')} centro`));
            variants.push(withItaly(`${words[0]} centro`));
        }
    }
    return [...new Set(variants)];
}

async function geocode(raw: string): Promise<{ lat: number; lng: number } | null> {
    const normalized = normalizeAddress(raw);
    for (const query of addressVariants(normalized)) {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=it&language=it&key=${KEY}`;
            const res = await fetch(url);
            const data = await res.json() as any;
            if (data.status === 'OK' && data.results?.[0]) {
                const loc = data.results[0].geometry.location;
                return { lat: loc.lat, lng: loc.lng };
            }
        } catch { /* continua */ }
    }
    // Fallback Places Text Search
    try {
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(withItaly(normalizeAddress(raw)))}&region=it&language=it&key=${KEY}`;
        const res = await fetch(url);
        const data = await res.json() as any;
        if (data.status === 'OK' && data.results?.[0]) {
            const loc = data.results[0].geometry.location;
            return { lat: loc.lat, lng: loc.lng };
        }
    } catch { /* ignora */ }
    return null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
    if (req.method !== 'GET') return res.status(405).end();
    if (!KEY) return res.status(500).json({ error: 'API key not configured' });

    const { origin, destination } = req.query as { origin?: string; destination?: string };
    if (!origin || !destination) return res.status(400).json({ error: 'Missing origin or destination' });

    const [a, b] = await Promise.all([geocode(origin), geocode(destination)]);
    if (!a || !b) return res.status(200).json({ km: null, error: 'geocode_failed' });

    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${a.lat},${a.lng}&destinations=${b.lat},${b.lng}&mode=driving&units=metric&region=it&language=it&key=${KEY}`;
        const gRes = await fetch(url);
        const data = await gRes.json() as any;
        const element = data?.rows?.[0]?.elements?.[0];
        if (element?.status !== 'OK') return res.status(200).json({ km: null, error: 'route_not_found' });
        return res.status(200).json({ km: element.distance.value / 1000 });
    } catch {
        return res.status(500).json({ error: 'distance_failed' });
    }
}
