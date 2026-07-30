import { useState, useCallback } from 'react';
import type { Operator } from '../types';

// Key basata su userId (disponibile sia in sidebar che in dashboard)
const SESSION_KEY = (userId: string) => `mws_operator_session_${userId}`;

export function useOperatorSession(clientId: string | undefined) {
    const getStored = (): Operator | null => {
        if (!clientId) return null;
        try {
            const raw = sessionStorage.getItem(SESSION_KEY(clientId));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    const [activeOperator, setActiveOperatorState] = useState<Operator | null>(getStored);

    const setActiveOperator = useCallback((op: Operator | null) => {
        if (!clientId) return;
        if (op) {
            sessionStorage.setItem(SESSION_KEY(clientId), JSON.stringify(op));
        } else {
            sessionStorage.removeItem(SESSION_KEY(clientId));
        }
        setActiveOperatorState(op);
    }, [clientId]);

    return { activeOperator, setActiveOperator };
}
