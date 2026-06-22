// Cache geocoding results per sessione (chiave = indirizzo normalizzato)
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();
// Cache distanze stradali (chiave = "lat1,lon1|lat2,lon2")
const routeCache = new Map<string, number | null>();

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
    const key = address.trim().toLowerCase();
    if (geocodeCache.has(key)) return geocodeCache.get(key)!;
    try {
        // Aggiunge "Italia" se manca, per migliorare la precisione geocoding
        const query = /italia|italy/i.test(address) ? address : `${address}, Italia`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=it`;
        const res = await fetch(url, {
            headers: { 'Accept-Language': 'it', 'User-Agent': 'MWSLeadManager/1.0' },
        });
        const data = await res.json();
        const result = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
        geocodeCache.set(key, result);
        return result;
    } catch {
        return null;
    }
}

async function roadDistanceKm(
    a: { lat: number; lon: number },
    b: { lat: number; lon: number },
): Promise<number | null> {
    const cacheKey = `${a.lat.toFixed(5)},${a.lon.toFixed(5)}|${b.lat.toFixed(5)},${b.lon.toFixed(5)}`;
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey)!;
    try {
        // OSRM public demo server — gratuito, dati OSM, distanza stradale reale
        const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
        const res = await fetch(url);
        const data = await res.json();
        const meters: number | undefined = data?.routes?.[0]?.distance;
        const result = meters != null ? meters / 1000 : null;
        routeCache.set(cacheKey, result);
        return result;
    } catch {
        return null;
    }
}

export async function calculateDistanceKm(
    companyAddress: string,
    workAddress: string,
): Promise<{ km: number; mode: 'road' | 'straight' } | null> {
    if (!companyAddress.trim() || !workAddress.trim()) return null;

    const [a, b] = await Promise.all([geocode(companyAddress), geocode(workAddress)]);
    if (!a || !b) return null;

    // Prima prova percorso stradale, poi fallback in linea d'aria
    const roadKm = await roadDistanceKm(a, b);
    if (roadKm != null) return { km: roadKm, mode: 'road' };

    // Fallback Haversine (linea d'aria)
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const sin2 =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    const straightKm = R * 2 * Math.asin(Math.sqrt(sin2));
    return { km: straightKm, mode: 'straight' };
}
