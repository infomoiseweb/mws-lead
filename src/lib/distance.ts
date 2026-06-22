const cache = new Map<string, { lat: number; lon: number } | null>();

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
    if (cache.has(address)) return cache.get(address)!;
    try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
        const data = await res.json();
        const result = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
        cache.set(address, result);
        return result;
    } catch {
        return null;
    }
}

function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const sin2 =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(sin2));
}

export async function calculateDistanceKm(
    companyAddress: string,
    workAddress: string,
): Promise<number | null> {
    if (!companyAddress.trim() || !workAddress.trim()) return null;
    const [a, b] = await Promise.all([geocode(companyAddress), geocode(workAddress)]);
    if (!a || !b) return null;
    return haversineKm(a, b);
}
