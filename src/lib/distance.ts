const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;

// Cache sessione
const geocodeCache = new Map<string, { lat: number; lng: number; formatted: string } | null>();
const routeCache = new Map<string, number | null>();

/**
 * Normalizza un indirizzo grezzo:
 * - sostituisce " - " e varianti con ", "
 * - rimuove caratteri di punteggiatura iniziali/finali
 * - collassa spazi multipli
 * - aggiunge ", Italia" se non presente per aiutare la disambiguazione
 */
function normalizeAddress(raw: string): string {
    return raw
        .trim()
        .replace(/\s*[–—-]\s*/g, ', ')   // "Piacenza - Villanova" → "Piacenza, Villanova"
        .replace(/[^\w\s,.'àáèéìíòóùú]/gi, ' ')  // rimuove simboli strani
        .replace(/\s{2,}/g, ' ')
        .trim();
}

function withItaly(address: string): string {
    return /italia|italy/i.test(address) ? address : `${address}, Italia`;
}

/** Genera varianti dell'indirizzo da provare in sequenza */
function addressVariants(normalized: string): string[] {
    const variants: string[] = [];
    // 1. Indirizzo normalizzato completo
    variants.push(withItaly(normalized));

    const parts = normalized.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length > 1) {
        // 2. Solo prima parte (es. "Piacenza" da "Piacenza, Villanova sull'Arda")
        variants.push(withItaly(parts[0]));
        // 3. Solo ultima parte
        variants.push(withItaly(parts[parts.length - 1]));
        // 4. Ordine invertito delle parti
        variants.push(withItaly([...parts].reverse().join(', ')));
    } else {
        // Indirizzo senza virgola: potrebbe essere "Città frazione" o "Città Provincia"
        const words = normalized.trim().split(/\s+/);
        if (words.length >= 2) {
            // 2. Aggiungi virgola tra le parole: "Pavia, Ceranova"
            variants.push(withItaly(`${words[0]}, ${words.slice(1).join(' ')}`));
            // 3. Ordine inverso con virgola: "Ceranova, Pavia"
            variants.push(withItaly(`${words.slice(1).join(' ')}, ${words[0]}`));
            // 4. Solo seconda parola (spesso è la città principale)
            variants.push(withItaly(words.slice(1).join(' ')));
            // 5. Solo prima parola
            variants.push(withItaly(words[0]));
        }
    }

    // Deduplicazione mantenendo l'ordine
    return [...new Set(variants)];
}

/** Geocodifica con Google — restituisce lat/lng e l'indirizzo formattato da Google */
async function geocodeGoogle(raw: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
    const normalized = normalizeAddress(raw);
    const cacheKey = normalized.toLowerCase();
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

    // 1. Prova tutte le varianti con Geocoding API
    for (const query of addressVariants(normalized)) {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=it&language=it&key=${GOOGLE_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            if (data.status === 'OK' && data.results?.[0]) {
                const loc = data.results[0].geometry.location;
                const result = { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
                geocodeCache.set(cacheKey, result);
                return result;
            }
        } catch { /* continua */ }
    }

    // 2. Fallback: Places Text Search — gestisce linguaggio naturale e indirizzi parziali
    try {
        const query = withItaly(normalized);
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=it&language=it&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.status === 'OK' && data.results?.[0]) {
            const loc = data.results[0].geometry.location;
            const result = { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
            geocodeCache.set(cacheKey, result);
            return result;
        }
    } catch { /* continua */ }

    geocodeCache.set(cacheKey, null);
    return null;
}

/** Distance Matrix usando lat/lng — elimina ambiguità sugli indirizzi */
async function distanceMatrixGoogle(
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number },
): Promise<number | null> {
    const cacheKey = `${origin.lat.toFixed(5)},${origin.lng.toFixed(5)}|${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
    if (routeCache.has(cacheKey)) return routeCache.get(cacheKey)!;
    try {
        const orig = `${origin.lat},${origin.lng}`;
        const dest = `${destination.lat},${destination.lng}`;
        const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${orig}&destinations=${dest}&mode=driving&units=metric&region=it&language=it&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        const element = data?.rows?.[0]?.elements?.[0];
        if (element?.status !== 'OK') { routeCache.set(cacheKey, null); return null; }
        const km = element.distance.value / 1000;
        routeCache.set(cacheKey, km);
        return km;
    } catch { return null; }
}

// ─── Fallback OSM + OSRM ──────────────────────────────────────────────────────

const osmCache = new Map<string, { lat: number; lng: number } | null>();

async function geocodeOsm(raw: string): Promise<{ lat: number; lng: number } | null> {
    const normalized = normalizeAddress(raw);
    const cacheKey = normalized.toLowerCase();
    if (osmCache.has(cacheKey)) return osmCache.get(cacheKey)!;
    for (const query of addressVariants(normalized)) {
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&countrycodes=it`;
            const res = await fetch(url, { headers: { 'Accept-Language': 'it', 'User-Agent': 'MWSLeadManager/1.0' } });
            const data = await res.json();
            if (data[0]) {
                const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
                osmCache.set(cacheKey, result);
                return result;
            }
        } catch { /* continua */ }
    }
    osmCache.set(cacheKey, null);
    return null;
}

async function distanceOsrm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): Promise<number | null> {
    try {
        const url = `https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=false`;
        const res = await fetch(url);
        const data = await res.json();
        const meters: number | undefined = data?.routes?.[0]?.distance;
        return meters != null ? meters / 1000 : null;
    } catch { return null; }
}

// ─── Esportazione principale ───────────────────────────────────────────────────

export async function calculateDistanceKm(
    companyAddress: string,
    workAddress: string,
): Promise<{ km: number; mode: 'google' | 'road' | 'straight' } | null> {
    if (!companyAddress.trim() || !workAddress.trim()) return null;

    // 1. Google Maps (più preciso): geocoding → coordinate → Distance Matrix
    if (GOOGLE_API_KEY) {
        const [a, b] = await Promise.all([geocodeGoogle(companyAddress), geocodeGoogle(workAddress)]);
        if (a && b) {
            const km = await distanceMatrixGoogle(a, b);
            if (km != null) return { km, mode: 'google' };
        }
    }

    // 2. Fallback OSRM
    const [a, b] = await Promise.all([geocodeOsm(companyAddress), geocodeOsm(workAddress)]);
    if (!a || !b) return null;

    const roadKm = await distanceOsrm(a, b);
    if (roadKm != null) return { km: roadKm, mode: 'road' };

    // 3. Fallback linea d'aria
    const R = 6371;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLon = ((b.lng - a.lng) * Math.PI) / 180;
    const sin2 =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return { km: R * 2 * Math.asin(Math.sqrt(sin2)), mode: 'straight' };
}
