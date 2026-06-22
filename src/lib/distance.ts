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

/** True se l'indirizzo sembra solo un nome di città (nessun numero, nessuna via/piazza) */
function looksLikeCityOnly(s: string): boolean {
    return !/\d/.test(s) && !/\b(via|viale|piazza|corso|strada|localita|loc\.|fraz\.|frazione)\b/i.test(s);
}

/** Genera varianti dell'indirizzo da provare in sequenza */
function addressVariants(normalized: string): string[] {
    const variants: string[] = [];

    // 1. Indirizzo normalizzato completo
    variants.push(withItaly(normalized));

    // 2. Se sembra solo un nome di città, aggiungi "centro" per ancorarlo al centro urbano
    if (looksLikeCityOnly(normalized)) {
        variants.push(withItaly(`${normalized} centro`));
    }

    const parts = normalized.split(',').map(p => p.trim()).filter(Boolean);

    if (parts.length > 1) {
        // 3. Solo prima parte (es. "Piacenza" da "Piacenza, Villanova sull'Arda")
        variants.push(withItaly(parts[0]));
        variants.push(withItaly(`${parts[0]} centro`));
        // 4. Solo ultima parte
        variants.push(withItaly(parts[parts.length - 1]));
        // 5. Ordine invertito delle parti
        variants.push(withItaly([...parts].reverse().join(', ')));
    } else {
        const words = normalized.trim().split(/\s+/);
        if (words.length >= 2) {
            // 6. Aggiungi virgola tra le parole: "Pavia, Ceranova"
            variants.push(withItaly(`${words[0]}, ${words.slice(1).join(' ')}`));
            // 7. Ordine inverso con virgola: "Ceranova, Pavia"
            variants.push(withItaly(`${words.slice(1).join(' ')}, ${words[0]}`));
            // 8. Solo seconda parola + centro
            variants.push(withItaly(`${words.slice(1).join(' ')} centro`));
            // 9. Solo prima parola + centro
            variants.push(withItaly(`${words[0]} centro`));
        }
    }

    return [...new Set(variants)];
}

/** Geocodifica con Google — restituisce lat/lng e l'indirizzo formattato da Google */
async function geocodeGoogle(raw: string): Promise<{ lat: number; lng: number; formatted: string } | null> {
    const normalized = normalizeAddress(raw);
    const cacheKey = normalized.toLowerCase();
    if (geocodeCache.has(cacheKey)) return geocodeCache.get(cacheKey)!;

    // 1. Prova tutte le varianti con Geocoding API
    const variants = addressVariants(normalized);
    console.debug('[Distance] geocoding variants:', variants);
    for (const query of variants) {
        try {
            const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&region=it&language=it&key=${GOOGLE_API_KEY}`;
            const res = await fetch(url);
            const data = await res.json();
            console.debug(`[Distance] Geocoding "${query}" →`, data.status, data.error_message || '');
            if (data.status === 'OK' && data.results?.[0]) {
                const loc = data.results[0].geometry.location;
                const result = { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
                geocodeCache.set(cacheKey, result);
                return result;
            }
        } catch (e) { console.debug('[Distance] Geocoding fetch error:', e); }
    }

    // 2. Fallback: Places Text Search
    try {
        const query = withItaly(normalized);
        const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&region=it&language=it&key=${GOOGLE_API_KEY}`;
        const res = await fetch(url);
        const data = await res.json();
        console.debug(`[Distance] Places Text Search "${query}" →`, data.status, data.error_message || '');
        if (data.status === 'OK' && data.results?.[0]) {
            const loc = data.results[0].geometry.location;
            const result = { lat: loc.lat, lng: loc.lng, formatted: data.results[0].formatted_address };
            geocodeCache.set(cacheKey, result);
            return result;
        }
    } catch (e) { console.debug('[Distance] Places fetch error:', e); }

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
