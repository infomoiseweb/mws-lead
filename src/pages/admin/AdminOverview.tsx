import React, { useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Users, TrendingUp, Target, DollarSign, Activity, Loader2 } from 'lucide-react';
import * as ApiService from '@api';
import type { Client, Lead } from '../../types';
import StatCard from '@components/dashboard/StatCard';
import { StatusDonutChart, MonthlyTrendChart, ClientBarChart } from '@components/dashboard/OverviewCharts';
import DateRangeFilter from '@components/ui/DateRangeFilter';

const formatCurrency = (value: number) =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(value);

const AdminOverview: React.FC = () => {
    const { t } = useTranslation();
    const [clients, setClients] = useState<Client[]>([]);
    const [installmentRevenue, setInstallmentRevenue] = useState<{ month: string; total_paid: number }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });

    useEffect(() => {
        let mounted = true;
        Promise.all([
            ApiService.getClients(),
            ApiService.getInstallmentRevenueByMonth().catch(() => []),
        ]).then(([data, ir]) => {
            if (!mounted) return;
            setClients(data);
            setInstallmentRevenue(ir);
        }).finally(() => { if (mounted) setIsLoading(false); });
        return () => { mounted = false; };
    }, []);

    const stats = useMemo(() => {
        const inRange = (dateStr: string) => {
            const d = new Date(dateStr);
            if (dateRange.start && d < dateRange.start) return false;
            if (dateRange.end && d > dateRange.end) return false;
            return true;
        };

        const allLeads: Lead[] = clients.flatMap(c => c.leads || []).filter(l => inRange(l.created_at));
        const totalLeads = allLeads.length;
        const wonLeads = allLeads.filter(l => l.status === 'Vinto');
        const openLeads = allLeads.filter(l => l.status !== 'Vinto' && l.status !== 'Perso' && l.status !== 'A Rate');
        const conversionRate = totalLeads > 0 ? (wonLeads.length / totalLeads) * 100 : 0;

        // Escludi lead con piano rate: il loro valore è già contato in installmentRevenue
        const leadsRevenue = wonLeads.filter(l => !l.has_payment_plan).reduce((sum, l) => sum + (l.value || 0), 0);
        const irStart = dateRange.start ? dateRange.start.toISOString().slice(0, 7) : null;
        const irEnd = dateRange.end ? dateRange.end.toISOString().slice(0, 7) : null;
        const irTotal = installmentRevenue
            .filter(r => (!irStart || r.month >= irStart) && (!irEnd || r.month <= irEnd))
            .reduce((s, r) => s + r.total_paid, 0);
        const revenue = leadsRevenue + irTotal;
        const adSpend = clients.flatMap(c => c.adSpends || []).filter(a => inRange(a.date)).reduce((sum, a) => sum + (a.amount || 0), 0);
        const roi = adSpend > 0 ? ((revenue - adSpend) / adSpend) * 100 : 0;

        const leadsByStatus: Record<string, number> = {};
        allLeads.forEach(l => { leadsByStatus[l.status] = (leadsByStatus[l.status] || 0) + 1; });

        const topClients = clients.map(c => ({ name: c.name, count: (c.leads || []).filter(l => inRange(l.created_at)).length }));

        return { allLeads, totalLeads, wonLeads, openLeads, conversionRate, revenue, adSpend, roi, leadsByStatus, topClients };
    }, [clients, dateRange, installmentRevenue]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">{t('overview.title')}</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('overview.admin_subtitle')}</p>
                </div>
                <DateRangeFilter onDateChange={(range) => setDateRange(range as { start: Date | null; end: Date | null })} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Activity size={22} />}
                    label={t('overview.stat_total_leads')}
                    value={stats.totalLeads.toLocaleString()}
                    subValue={`${stats.openLeads.length} ${t('overview.stat_open_leads').toLowerCase()}`}
                    gradient="from-primary-400 to-primary-600"
                />
                <StatCard
                    icon={<Target size={22} />}
                    label={t('overview.stat_conversion_rate')}
                    value={`${stats.conversionRate.toFixed(1)}%`}
                    subValue={`${stats.wonLeads.length} ${t('overview.stat_won_leads').toLowerCase()}`}
                    gradient="from-emerald-500 to-emerald-700"
                />
                <StatCard
                    icon={<Users size={22} />}
                    label={t('overview.stat_total_clients')}
                    value={clients.length.toString()}
                    gradient="from-primary-600 to-primary-900"
                />
                <StatCard
                    icon={<DollarSign size={22} />}
                    label={t('overview.stat_revenue')}
                    value={formatCurrency(stats.revenue)}
                    subValue={`${t('overview.stat_ad_spend')}: ${formatCurrency(stats.adSpend)}`}
                    gradient="from-slate-700 to-slate-900"
                />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2">
                    <MonthlyTrendChart
                        leads={stats.allLeads}
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

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-3">
                    {clients.length > 0 ? (
                        <ClientBarChart data={stats.topClients} title={t('overview.chart_top_clients')} />
                    ) : (
                        <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 text-center text-sm text-slate-400 border border-slate-100 dark:border-slate-700/50">
                            {t('overview.no_clients')}
                        </div>
                    )}
                </div>
            </div>

            {stats.adSpend > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatCard
                        icon={<TrendingUp size={22} />}
                        label={t('overview.stat_roi')}
                        value={`${stats.roi.toFixed(1)}%`}
                        gradient="from-emerald-500 to-emerald-700"
                    />
                </div>
            )}
        </div>
    );
};

export default AdminOverview;
