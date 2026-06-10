import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';
import { Activity, Target, DollarSign, TrendingUp, Loader2 } from 'lucide-react';
import * as ApiService from '@api';
import type { Client } from '../../types';
import StatCard from '@components/dashboard/StatCard';
import { StatusDonutChart, MonthlyTrendChart } from '@components/dashboard/OverviewCharts';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const ClientOverview: React.FC = () => {
    const { t } = useTranslation();
    const { userId } = useParams();
    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!userId) return;
        let mounted = true;
        ApiService.getClientByUserId(userId)
            .then(data => { if (mounted) setClient(data); })
            .finally(() => { if (mounted) setIsLoading(false); });
        return () => { mounted = false; };
    }, [userId]);

    const stats = useMemo(() => {
        const leads = client?.leads || [];
        const totalLeads = leads.length;
        const wonLeads = leads.filter(l => l.status === 'Vinto');
        const openLeads = leads.filter(l => l.status !== 'Vinto' && l.status !== 'Perso');
        const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;

        const revenue = wonLeads.reduce((sum, l) => sum + (l.value || 0), 0);
        const adSpend = (client?.adSpends || []).reduce((sum, a) => sum + (a.amount || 0), 0);
        const roi = adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : 0;

        const leadsByStatus: Record<string, number> = {};
        leads.forEach(l => { leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1; });

        const now = new Date();
        const thisMonthLeads = leads.filter(l => {
            const d = new Date(l.created_at);
            return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
        });

        return { leads, totalLeads, wonLeads, openLeads, conversionRate, revenue, adSpend, roi, leadsByStatus, thisMonthLeads };
    }, [client]);

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
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('overview.title')}</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('overview.client_subtitle')}</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Activity size={22} />}
                    label={t('overview.stat_total_leads')}
                    value={stats.totalLeads.toLocaleString()}
                    subValue={`${stats.thisMonthLeads.length} ${t('overview.this_month').toLowerCase()}`}
                    gradient="from-cyan-500 to-blue-600"
                />
                <StatCard
                    icon={<Target size={22} />}
                    label={t('overview.stat_conversion_rate')}
                    value={`${stats.conversionRate.toFixed(1)}%`}
                    subValue={`${stats.wonLeads.length} ${t('overview.stat_won_leads').toLowerCase()}`}
                    gradient="from-emerald-500 to-green-600"
                />
                <StatCard
                    icon={<DollarSign size={22} />}
                    label={t('overview.stat_revenue')}
                    value={formatCurrency(stats.revenue)}
                    subValue={`${t('overview.stat_ad_spend')}: ${formatCurrency(stats.adSpend)}`}
                    gradient="from-amber-500 to-orange-600"
                />
                <StatCard
                    icon={<TrendingUp size={22} />}
                    label={t('overview.stat_roi')}
                    value={stats.adSpend > 0 ? `${stats.roi.toFixed(1)}%` : '—'}
                    subValue={`${stats.openLeads.length} ${t('overview.stat_open_leads').toLowerCase()}`}
                    gradient="from-purple-500 to-indigo-600"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <MonthlyTrendChart
                        leads={stats.leads}
                        title={t('overview.chart_monthly_trend')}
                        leadsLabel={t('overview.leads_label')}
                        wonLabel={t('overview.won_label')}
                    />
                </div>
                <StatusDonutChart
                    leadsByStatus={stats.leadsByStatus}
                    title={t('overview.chart_status_breakdown')}
                    totalLabel={t('overview.total_label')}
                />
            </div>
        </div>
    );
};

export default ClientOverview;
