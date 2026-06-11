export interface GeocodeResult {
    lat: number;
    lng: number;
    displayName: string;
}

// Geocoding gratuito tramite Nominatim (OpenStreetMap), nessuna API key richiesta.
export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=it&q=${encodeURIComponent(address)}`;
    const res = await fetch(url, { headers: { 'Accept-Language': 'it' } });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.[0]) return null;
    return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        displayName: data[0].display_name,
    };
}
