import React, { useEffect, useState } from 'react';
import { getLeadStatusLogs } from '@api/operators';
import type { LeadStatusLog } from '../../types';
import { Clock, RefreshCw } from 'lucide-react';

interface LeadStatusHistoryProps {
    leadId: string;
}

const LeadStatusHistory: React.FC<LeadStatusHistoryProps> = ({ leadId }) => {
    const [logs, setLogs] = useState<LeadStatusLog[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getLeadStatusLogs(leadId)
            .then(setLogs)
            .finally(() => setLoading(false));
    }, [leadId]);

    if (loading) return (
        <div className="flex justify-center py-8">
            <RefreshCw className="w-5 h-5 animate-spin text-slate-400" />
        </div>
    );

    if (logs.length === 0) return (
        <div className="flex flex-col items-center justify-center py-10 gap-2 text-center">
            <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600" />
            <p className="text-sm text-slate-500 dark:text-gray-400">Nessuna azione registrata</p>
        </div>
    );

    return (
        <div className="space-y-3 py-2">
            {logs.map((log, i) => (
                <div key={log.id} className="flex gap-3">
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                            style={{ backgroundColor: log.operator_id ? '#6366f1' : '#94a3b8' }}>
                            {log.operator_name ? log.operator_name.charAt(0).toUpperCase() : '?'}
                        </div>
                        {i < logs.length - 1 && <div className="w-0.5 flex-1 bg-slate-200 dark:bg-slate-700 mt-1 mb-0 min-h-[1rem]" />}
                    </div>
                    {/* Content */}
                    <div className="flex-1 pb-3">
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                                {log.operator_name || 'Operatore sconosciuto'}
                            </span>
                            {log.old_status && (
                                <>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">{log.old_status}</span>
                                    <span className="text-slate-400 text-xs">→</span>
                                </>
                            )}
                            <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 font-medium">{log.new_status}</span>
                        </div>
                        {log.note && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5 italic">"{log.note}"</p>}
                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                            {new Date(log.created_at).toLocaleString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                    </div>
                </div>
            ))}
        </div>
    );
};

export default LeadStatusHistory;
