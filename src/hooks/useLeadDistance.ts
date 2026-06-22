import { useState, useEffect } from 'react';
import type { Client, Lead } from '../types';
import { calculateDistanceKm } from '@lib/distance';

export function useLeadDistance(client: Client | null | undefined, lead: Lead | null | undefined) {
    const [distanceKm, setDistanceKm] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const settings = client?.distance_settings;
        if (!settings?.enabled || !settings.company_address || !settings.location_field || !lead) {
            setDistanceKm(null);
            return;
        }

        const workAddress = lead.data?.[settings.location_field];
        if (!workAddress) {
            setDistanceKm(null);
            return;
        }

        setIsLoading(true);
        calculateDistanceKm(settings.company_address, workAddress).then(km => {
            setDistanceKm(km);
            setIsLoading(false);
        });
    }, [client, lead]);

    return { distanceKm, isLoading };
}
