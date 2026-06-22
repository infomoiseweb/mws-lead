const routeCache = new Map<string, number | null>();

export async function calculateDistanceKm(
    companyAddress: string,
    workAddress: string,
): Promise<{ km: number; mode: 'google' | 'road' | 'straight' } | null> {
    if (!companyAddress.trim() || !workAddress.trim()) return null;

    const cacheKey = `${companyAddress}|${workAddress}`;
    if (routeCache.has(cacheKey)) {
        const cached = routeCache.get(cacheKey);
        return cached != null ? { km: cached, mode: 'google' } : null;
    }

    try {
        const params = new URLSearchParams({ origin: companyAddress, destination: workAddress });
        const res = await fetch(`/api/distance?${params}`);
        const data = await res.json();
        const km: number | null = data?.km ?? null;
        routeCache.set(cacheKey, km);
        return km != null ? { km, mode: 'google' } : null;
    } catch {
        routeCache.set(cacheKey, null);
        return null;
    }
}
