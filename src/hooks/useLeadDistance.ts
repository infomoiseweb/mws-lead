import { useState, useEffect } from 'react';
import type { Client, Lead } from '../types';
import { calculateDistanceKm } from '@lib/distance';

export function useLeadDistance(client: Client | null | undefined, lead: Lead | null | undefined) {
    const [result, setResult] = useState<{ km: number; mode: 'road' | 'straight' } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const settings = client?.distance_settings;
        if (!settings?.enabled || !settings.company_address || !settings.location_field || !lead) {
            setResult(null);
            return;
        }
        const workAddress = lead.data?.[settings.location_field];
        if (!workAddress) {
            setResult(null);
            return;
        }
        setIsLoading(true);
        calculateDistanceKm(settings.company_address, workAddress).then(r => {
            setResult(r);
            setIsLoading(false);
        });
    }, [client, lead]);

    return { result, isLoading };
}
