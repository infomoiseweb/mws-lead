import React, { useMemo } from 'react';
import {
    Chart as ChartJS,
    ArcElement,
    CategoryScale,
    LinearScale,
    BarElement,
    PointElement,
    LineElement,
    Tooltip,
    Legend,
    Filler,
    ChartOptions,
    ScriptableContext,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';
import { useTranslation } from 'react-i18next';
import type { Lead } from '../../types';

ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, PointElement, LineElement, Tooltip, Legend, Filler);

const statusOrder: Lead['status'][] = ['Nuovo', 'Contattato', 'In Lavorazione', 'Preventivo Inviato', 'Vinto', 'Perso'];
// Palette basata sui colori del brand (blu primario) con due accenti semantici (verde/rosso per esito)
const statusColors: Record<Lead['status'], string> = {
    'Nuovo': '#93c5fd',
    'Contattato': '#3b82f6',
    'In Lavorazione': '#1d4ed8',
    'Vinto': '#22c55e',
    'Perso': '#ef4444',
    'Preventivo Inviato': '#0ea5e9',
};

// 3D-ish drop shadow plugin for arcs/bars
const shadowPlugin = {
    id: 'shadowPlugin',
    beforeDraw: (chart: any) => {
        const { ctx } = chart;
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.35)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 8;
    },
    afterDraw: (chart: any) => {
        chart.ctx.restore();
    },
};

interface StatusDonutChartProps {
    leadsByStatus: Record<string, number>;
    title: string;
    totalLabel: string;
}

export const StatusDonutChart: React.FC<StatusDonutChartProps> = ({ leadsByStatus, title, totalLabel }) => {
    const { t } = useTranslation();
    const total = Object.values(leadsByStatus).reduce((a, b) => a + b, 0);

    const entries = statusOrder
        .map(status => ({ status, count: leadsByStatus[status] || 0 }))
        .filter(e => e.count > 0);

    const data = {
        labels: entries.map(e => t(`lead_status.${e.status}`)),
        datasets: [
            {
                data: entries.map(e => e.count),
                backgroundColor: entries.map(e => statusColors[e.status]),
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 2,
                hoverOffset: 10,
            },
        ],
    };

    const options: ChartOptions<'doughnut'> = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '68%',
        plugins: {
            legend: {
                position: 'bottom',
                labels: { color: '#9aa4ad', boxWidth: 12, padding: 14, font: { size: 11 } },
            },
            tooltip: {
                backgroundColor: '#0d0d0d',
                titleColor: '#ffffff',
                bodyColor: '#ffffff',
                padding: 10,
                borderColor: 'rgba(255,255,255,0.1)',
                borderWidth: 1,
            },
        },
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-[0_10px_25px_-8px_rgba(0,0,0,0.25)] border border-slate-100 dark:border-slate-700/50 h-full flex flex-col">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{title}</h3>
            <div className="relative flex-1 min-h-[220px]">
                {total > 0 ? (
                    <>
                        <Doughnut data={data} options={options} plugins={[shadowPlugin]} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none" style={{ marginBottom: '40px' }}>
                            <span className="text-2xl font-bold text-slate-800 dark:text-white">{total}</span>
                            <span className="text-[11px] text-slate-400 uppercase tracking-wide">{totalLabel}</span>
                        </div>
                    </>
                ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">—</div>
                )}
            </div>
        </div>
    );
};

interface MonthlyTrendChartProps {
    leads: Lead[];
    title: string;
    leadsLabel: string;
    wonLabel: string;
}

export const MonthlyTrendChart: React.FC<MonthlyTrendChartProps> = ({ leads, title, leadsLabel, wonLabel }) => {
    const monthlyData = useMemo(() => {
        const months: string[] = [];
        const leadsCount: number[] = [];
        const wonCount: number[] = [];
        const now = new Date();

        for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const label = d.toLocaleDateString('it-IT', { month: 'short' });
            months.push(label.charAt(0).toUpperCase() + label.slice(1));

            const count = leads.filter(l => {
                const ld = new Date(l.created_at);
                return ld.getFullYear() === d.getFullYear() && ld.getMonth() === d.getMonth();
            });
            leadsCount.push(count.length);
            wonCount.push(count.filter(l => l.status === 'Vinto').length);
        }

        return { months, leadsCount, wonCount };
    }, [leads]);

    const options: ChartOptions<'line'> = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
            legend: { position: 'top', labels: { color: '#9aa4ad', boxWidth: 12, font: { size: 11 } } },
            tooltip: { backgroundColor: '#0d0d0d', titleColor: '#00e5ff', bodyColor: '#fff', padding: 10 },
        },
        scales: {
            x: { grid: { display: false }, ticks: { color: '#9aa4ad' } },
            y: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#9aa4ad', precision: 0 }, beginAtZero: true },
        },
    };

    const data = {
        labels: monthlyData.months,
        datasets: [
            {
                label: leadsLabel,
                data: monthlyData.leadsCount,
                fill: true,
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
                    gradient.addColorStop(0, 'rgba(59,130,246,0.35)');
                    gradient.addColorStop(1, 'rgba(59,130,246,0.02)');
                    return gradient;
                },
                borderColor: '#3b82f6',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: '#3b82f6',
            },
            {
                label: wonLabel,
                data: monthlyData.wonCount,
                fill: true,
                backgroundColor: (context: ScriptableContext<'line'>) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
                    gradient.addColorStop(0, 'rgba(34,197,94,0.35)');
                    gradient.addColorStop(1, 'rgba(34,197,94,0.02)');
                    return gradient;
                },
                borderColor: '#22c55e',
                borderWidth: 3,
                tension: 0.4,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: '#22c55e',
            },
        ],
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-[0_10px_25px_-8px_rgba(0,0,0,0.25)] border border-slate-100 dark:border-slate-700/50 h-full flex flex-col">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{title}</h3>
            <div className="relative flex-1 min-h-[220px]">
                <Line data={data} options={options} />
            </div>
        </div>
    );
};

interface ClientBarChartProps {
    data: { name: string; count: number }[];
    title: string;
}

export const ClientBarChart: React.FC<ClientBarChartProps> = ({ data, title }) => {
    const sorted = [...data].sort((a, b) => b.count - a.count).slice(0, 6);

    const options: ChartOptions<'bar'> = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: 'y',
        plugins: {
            legend: { display: false },
            tooltip: { backgroundColor: '#0d0d0d', titleColor: '#fff', bodyColor: '#fff', padding: 10 },
        },
        scales: {
            x: { grid: { color: 'rgba(148,163,184,0.12)' }, ticks: { color: '#9aa4ad', precision: 0 }, beginAtZero: true },
            y: { grid: { display: false }, ticks: { color: '#9aa4ad', font: { size: 11 } } },
        },
    };

    const data_ = {
        labels: sorted.map(d => d.name),
        datasets: [
            {
                data: sorted.map(d => d.count),
                backgroundColor: (context: ScriptableContext<'bar'>) => {
                    const ctx = context.chart.ctx;
                    const gradient = ctx.createLinearGradient(0, 0, 260, 0);
                    gradient.addColorStop(0, '#60a5fa');
                    gradient.addColorStop(1, '#1d4ed8');
                    return gradient;
                },
                borderRadius: 8,
                barThickness: 16,
            },
        ],
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-[0_10px_25px_-8px_rgba(0,0,0,0.25)] border border-slate-100 dark:border-slate-700/50 h-full flex flex-col">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">{title}</h3>
            <div className="relative flex-1 min-h-[220px]">
                {sorted.length > 0 ? (
                    <Bar data={data_} options={options} plugins={[shadowPlugin]} />
                ) : (
                    <div className="h-full flex items-center justify-center text-sm text-slate-400">—</div>
                )}
            </div>
        </div>
    );
};
