import { useState, useCallback, useEffect } from 'react';
import type { Operator } from '../types';

// Key basata su userId (disponibile sia in sidebar che in dashboard)
const SESSION_KEY = (userId: string) => `mws_operator_session_${userId}`;
const SYNC_EVENT = 'mws_operator_session_changed';

export function useOperatorSession(userId: string | undefined) {
    const getStored = (): Operator | null => {
        if (!userId) return null;
        try {
            const raw = sessionStorage.getItem(SESSION_KEY(userId));
            return raw ? JSON.parse(raw) : null;
        } catch {
            return null;
        }
    };

    const [activeOperator, setActiveOperatorState] = useState<Operator | null>(getStored);

    // Ascolta i cambiamenti da altre istanze del hook (es. Dashboard → Sidebar)
    useEffect(() => {
        if (!userId) return;
        const handler = () => setActiveOperatorState(getStored());
        window.addEventListener(SYNC_EVENT, handler);
        return () => window.removeEventListener(SYNC_EVENT, handler);
    }, [userId]);

    const setActiveOperator = useCallback((op: Operator | null) => {
        if (!userId) return;
        if (op) {
            sessionStorage.setItem(SESSION_KEY(userId), JSON.stringify(op));
        } else {
            sessionStorage.removeItem(SESSION_KEY(userId));
        }
        setActiveOperatorState(op);
        // Notifica tutte le altre istanze del hook nella stessa pagina
        window.dispatchEvent(new Event(SYNC_EVENT));
    }, [userId]);

    return { activeOperator, setActiveOperator };
}
