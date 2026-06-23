import { useState, useEffect, useCallback } from 'react';
import type { Client, Lead } from '../types';
import { calculateDistanceKm } from '@lib/distance';

export function useLeadDistance(client: Client | null | undefined, lead: Lead | null | undefined) {
    const [result, setResult] = useState<{ km: number; mode: 'google' | 'road' | 'straight' } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const calculate = useCallback(async (bustCache = false) => {
        const settings = client?.distance_settings;
        if (!settings?.enabled || !settings.company_address || !settings.location_field || !lead) {
            setResult(null);
            return;
        }
        const workAddress = lead.data?.[settings.location_field];
        if (!workAddress) { setResult(null); return; }
        setIsLoading(true);
        const r = await calculateDistanceKm(settings.company_address, workAddress, bustCache);
        setResult(r);
        setIsLoading(false);
    }, [client, lead]);

    useEffect(() => { calculate(); }, [calculate]);

    const refresh = useCallback(() => calculate(true), [calculate]);

    return { result, isLoading, refresh };
}
