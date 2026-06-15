import React, { useEffect, useState, useCallback } from 'react';
import * as ApiService from '@api';
import type { MailMarketingOverviewClient } from '../../types';
import { Loader2, Mail, CheckCircle2, Send, Users } from 'lucide-react';

const domainStatusBadge: Record<string, { label: string; classes: string }> = {
    verified: { label: 'Verificato', classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
    pending: { label: 'In attesa', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    failed: { label: 'Verifica fallita', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

const AdminMailMarketingPage: React.FC = () => {
    const [clients, setClients] = useState<MailMarketingOverviewClient[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [togglingId, setTogglingId] = useState<string | null>(null);

    const fetchData = useCallback(async () => {
        setIsLoading(true);
        setError('');
        try {
            const data = await ApiService.getMailMarketingOverview();
            setClients(data);
        } catch (err: any) {
            setError(err.message || 'Errore durante il caricamento dei dati.');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handleToggle = async (clientId: string, current: boolean) => {
        setTogglingId(clientId);
        try {
            await ApiService.setClientMailMarketingEnabled(clientId, !current);
            setClients(prev => prev.map(c => c.id === clientId ? { ...c, mail_marketing_enabled: !current } : c));
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'aggiornamento.');
        } finally {
            setTogglingId(null);
        }
    };

    const stats = clients.reduce((acc, c) => {
        const sent = c.mail_campaigns.reduce((sum, camp) => sum + camp.mail_campaign_recipients.filter(r => r.status === 'sent').length, 0);
        const failed = c.mail_campaigns.reduce((sum, camp) => sum + camp.mail_campaign_recipients.filter(r => r.status === 'failed' || r.status === 'bounced').length, 0);
        const campaignsSent = c.mail_campaigns.filter(camp => camp.status === 'sent' || camp.status === 'failed').length;
        return {
            enabledClients: acc.enabledClients + (c.mail_marketing_enabled ? 1 : 0),
            verifiedDomains: acc.verifiedDomains + (c.mail_domains.some(d => d.status === 'verified') ? 1 : 0),
            totalSent: acc.totalSent + sent,
            totalFailed: acc.totalFailed + failed,
            totalCampaigns: acc.totalCampaigns + campaignsSent,
        };
    }, { enabledClients: 0, verifiedDomains: 0, totalSent: 0, totalFailed: 0, totalCampaigns: 0 });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Mail Marketing</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Panoramica delle campagne email dei tuoi clienti e gestione dell'accesso alla sezione.
                </p>
            </div>

            {error && (
                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{error}</div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500 text-xs font-medium"><Users size={14} /> Clienti abilitati</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.enabledClients}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500 text-xs font-medium"><CheckCircle2 size={14} /> Domini verificati</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.verifiedDomains}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500 text-xs font-medium"><Send size={14} /> Campagne inviate</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalCampaigns}</div>
                </div>
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-100 dark:border-slate-700/50">
                    <div className="flex items-center gap-2 text-slate-400 dark:text-gray-500 text-xs font-medium"><Mail size={14} /> Email inviate</div>
                    <div className="text-2xl font-bold text-slate-800 dark:text-white mt-1">{stats.totalSent}</div>
                    {stats.totalFailed > 0 && <div className="text-xs text-red-500 mt-0.5">{stats.totalFailed} non riuscite</div>}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-3">Clienti</h3>

                {clients.length === 0 ? (
                    <div className="text-center text-sm text-slate-400 py-6">Nessun cliente trovato.</div>
                ) : (
                    <div className="overflow-x-auto -mx-2">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs text-slate-400 dark:text-gray-500">
                                    <th className="px-2 py-2 font-medium">Cliente</th>
                                    <th className="px-2 py-2 font-medium">Mail Marketing</th>
                                    <th className="px-2 py-2 font-medium">Dominio</th>
                                    <th className="px-2 py-2 font-medium">Campagne inviate</th>
                                    <th className="px-2 py-2 font-medium">Email inviate</th>
                                    <th className="px-2 py-2 font-medium">Ultimo invio</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                {clients.map(c => {
                                    const domain = c.mail_domains?.[0];
                                    const sentCampaigns = c.mail_campaigns.filter(camp => camp.status === 'sent' || camp.status === 'failed');
                                    const sent = sentCampaigns.reduce((sum, camp) => sum + camp.mail_campaign_recipients.filter(r => r.status === 'sent').length, 0);
                                    const failed = sentCampaigns.reduce((sum, camp) => sum + camp.mail_campaign_recipients.filter(r => r.status === 'failed' || r.status === 'bounced').length, 0);
                                    const lastSentAt = sentCampaigns
                                        .map(camp => camp.sent_at)
                                        .filter((d): d is string => !!d)
                                        .sort()
                                        .pop();

                                    return (
                                        <tr key={c.id} className="text-slate-700 dark:text-gray-200">
                                            <td className="px-2 py-2 font-medium">{c.name}</td>
                                            <td className="px-2 py-2">
                                                <button
                                                    onClick={() => handleToggle(c.id, c.mail_marketing_enabled)}
                                                    disabled={togglingId === c.id}
                                                    role="switch"
                                                    aria-checked={c.mail_marketing_enabled}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-50 ${c.mail_marketing_enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                    title={c.mail_marketing_enabled ? 'Disattiva per questo cliente' : 'Attiva per questo cliente'}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${c.mail_marketing_enabled ? 'translate-x-4' : 'translate-x-1'}`} />
                                                </button>
                                            </td>
                                            <td className="px-2 py-2">
                                                {domain ? (
                                                    <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${domainStatusBadge[domain.status]?.classes || ''}`}>
                                                        {domainStatusBadge[domain.status]?.label || domain.status}
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-slate-400 dark:text-gray-500">Non collegato</span>
                                                )}
                                            </td>
                                            <td className="px-2 py-2 text-xs">{sentCampaigns.length}</td>
                                            <td className="px-2 py-2 text-xs">
                                                {sent}
                                                {failed > 0 && <span className="text-red-500"> · {failed} non riuscite</span>}
                                            </td>
                                            <td className="px-2 py-2 text-xs whitespace-nowrap">
                                                {lastSentAt ? new Date(lastSentAt).toLocaleString('it-IT') : '—'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminMailMarketingPage;
