const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Cache per sessione
const geocodeCache = new Map<string, { lat: number; lon: number } | null>();
const routeCache = new Map<string, number | null>();

async function geocodeGoogle(address: string): Promise<{ lat: number; lon: number } | null> {
    const key = address.trim().toLowerCase();
    if (geocodeCache.has(key)) return geocodeCache.get(key)!;
    try {
        const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&region=it&language=it&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status !== 'OK' || !data.results?.[0]) { geocodeCache.set(key, null); return null; }
        const loc = data.results[0].geometry.location;
        const result = { lat: loc.lat, lon: loc.lng };
        geocodeCache.set(key, result);
        return result;
    } catch { return null; }
}

async function distanceMatrixGoogle(origin: string, destination: string): Promise<number | null> {
    const cacheKey = `${origin}|${destination}`;
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey)!;
    try {
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&mode=driving&region=it&language=it&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        const meters: number | undefined = data?.rows?.[0]?.elements?.[0]?.distance?.value;
        const result = meters != null ? meters / 1000 : null;
        routeCache.set(cacheKey, result);
        return result;
    } catch { return null; }
}

// Fallback OSRM se Google non è configurato
async function geocodeOsm(address: string): Promise<{ lat: number; lon: number } | null> {
    const key = address.trim().toLowerCase();
    if (geocodeCache.has(key)) return geocodeCache.get(key)!;
    try {
        const query = /italia|italy/i.test(address) ? address : `${address}, Italia`;
        const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=it`;
        const res = await fetch(url, { headers: { 'Accept-Language': 'it', 'User-Agent': 'MWSLeadManager/1.0' } });
        const data = await res.json();
        const result = data[0] ? { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) } : null;
        geocodeCache.set(key, result);
        return result;
    } catch { return null; }
}

async function distanceOsrm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): Promise<number | null> {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false`;
        const res = await fetch(url);
        const data = await res.json();
        const meters: number | undefined = data?.routes?.[0]?.distance;
        return meters != null ? meters / 1000 : null;
    } catch { return null; }
}

export async function calculateDistanceKm(
    companyAddress: string,
    workAddress: string,
): Promise<{ km: number; mode: 'google' | 'road' | 'straight' } | null> {
    if (!companyAddress.trim() || !workAddress.trim()) return null;

    // --- Percorso Google Maps (più preciso) ---
    if (GOOGLE_API_KEY) {
        const km = await distanceMatrixGoogle(companyAddress, workAddress);
        if (km != null) return { km, mode: 'google' };
    }

    // --- Fallback OSRM ---
    const [a, b] = await Promise.all([geocodeOsm(companyAddress), geocodeOsm(workAddress)]);
    if (!a || !b) return null;

    const roadKm = await distanceOsrm(a, b);
    if (roadKm != null) return { km: roadKm, mode: 'road' };

    // --- Fallback linea d'aria ---
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lon - a.lon) * Math.PI) / 180;
    const sin2 = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return { km: R * 2 * Math.asin(Math.sqrt(sin2)), mode: 'straight' };
}
