import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    CheckCircle, Clock, AlertCircle, Euro, TrendingUp,
    AlertTriangle, ListChecks, ChevronDown, ChevronUp,
    ChevronLeft, ChevronRight, Loader2,
} from 'lucide-react';
import { getPaymentPlans, markInstallmentPaid, getInstallmentRevenueByMonth, getInstallmentForecast } from '@api/index';
import type { PaymentPlan, Installment } from '../../types';
import StatCard from '@components/dashboard/StatCard';

/* ─── Helpers ──────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
const todayStr = () => new Date().toISOString().slice(0, 10);
const monthStr = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (ym: string) => {
    const [y, m] = ym.split('-');
    return new Date(Number(y), Number(m) - 1, 1).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
};

/* ─── InstallmentPill ─────────────────────────────────────── */
const InstallmentPill: React.FC<{ inst: Installment; index: number; onToggle: (inst: Installment) => void; saving: boolean }> = ({ inst, index, onToggle, saving }) => {
    const today = todayStr();
    const overdue = !inst.paid_at && inst.due_date < today;
    const isThisMonth = inst.due_date.startsWith(monthStr(new Date()));

    return (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
            inst.paid_at ? 'border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-900/10'
            : overdue ? 'border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-900/10'
            : isThisMonth ? 'border-amber-200 dark:border-amber-700/50 bg-amber-50 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/60'
        }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                inst.paid_at ? 'bg-emerald-500 text-white'
                : overdue ? 'bg-red-400 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-gray-300'
            }`}>{index + 1}</span>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-slate-800 dark:text-gray-100">{fmt(inst.amount)}</span>
                    {isThisMonth && !inst.paid_at && <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">Questo mese</span>}
                    {overdue && <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">Scaduta</span>}
                </div>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                    {inst.paid_at
                        ? <>Incassata il <span className="font-medium text-emerald-600 dark:text-emerald-400">{fmtDate(inst.paid_at)}</span></>
                        : <>Scadenza: <span className={`font-medium ${overdue ? 'text-red-500' : ''}`}>{fmtDate(inst.due_date)}</span></>}
                </p>
            </div>

            <button
                onClick={() => onToggle(inst)}
                disabled={saving}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 disabled:opacity-50 ${
                    inst.paid_at
                        ? 'border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20'
                        : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-gray-400 hover:bg-emerald-50 hover:border-emerald-400 hover:text-emerald-700 dark:hover:bg-emerald-900/20'
                }`}
            >
                {inst.paid_at ? <><CheckCircle size={11} /> Pagata</> : <><Clock size={11} /> Segna pagata</>}
            </button>
        </div>
    );
};

/* ─── PlanCard ─────────────────────────────────────────────── */
const PlanCard: React.FC<{ plan: PaymentPlan; onToggle: (inst: Installment) => void; saving: boolean; defaultOpen?: boolean }> = ({ plan, onToggle, saving, defaultOpen = false }) => {
    const [open, setOpen] = useState(defaultOpen);
    const installments = (plan.installments || []).slice().sort((a, b) => a.due_date.localeCompare(b.due_date));
    const today = todayStr();

    const paidList = installments.filter(i => i.paid_at);
    const unpaidList = installments.filter(i => !i.paid_at);
    const overdueList = unpaidList.filter(i => i.due_date < today);
    const upcomingList = unpaidList.filter(i => i.due_date >= today);

    const paidTotal = paidList.reduce((s, i) => s + i.amount, 0);
    const remainingTotal = unpaidList.reduce((s, i) => s + i.amount, 0);
    const progressPct = plan.total_amount > 0 ? Math.min(100, Math.round((paidTotal / plan.total_amount) * 100)) : 0;
    const isComplete = unpaidList.length === 0;
    const hasOverdue = overdueList.length > 0;
    const nextDue = upcomingList[0];

    const rawData = (plan as any).leads?.data;
    const leadName = rawData ? (rawData['Nome'] || rawData['nome'] || rawData['name'] || Object.values(rawData)[0] || '—') : '—';
    const leadService = (plan as any).leads?.service || '';

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border-2 overflow-hidden transition-all duration-200 ${
            isComplete ? 'border-emerald-200 dark:border-emerald-800/60'
            : hasOverdue ? 'border-red-200 dark:border-red-800/60'
            : 'border-slate-200 dark:border-slate-700'
        }`}>
            <button
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors text-left group"
                onClick={() => setOpen(v => !v)}
            >
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isComplete ? 'bg-emerald-500' : hasOverdue ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
                }`} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-gray-100 truncate">{leadName}</span>
                        {leadService && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">{leadService}</span>
                        )}
                        {(plan as any).quotes?.quote_number_display && (
                            <span className="text-xs text-slate-400 dark:text-gray-500">Prev. #{(plan as any).quotes.quote_number_display}</span>
                        )}
                    </div>

                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                        {isComplete ? (
                            <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1"><CheckCircle size={11} /> Completato</span>
                        ) : (
                            <>
                                <span className="text-xs text-slate-500 dark:text-gray-400">
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">{paidList.length} pagate</span>
                                    {' · '}
                                    <span className={`font-semibold ${hasOverdue ? 'text-red-500' : 'text-slate-700 dark:text-gray-200'}`}>{unpaidList.length} mancanti</span>
                                    {' su '}<span className="font-semibold">{installments.length}</span>
                                </span>
                                {hasOverdue && <span className="text-xs font-semibold text-red-500 flex items-center gap-0.5"><AlertCircle size={11} /> {overdueList.length} scadut{overdueList.length === 1 ? 'a' : 'e'}</span>}
                                {nextDue && !hasOverdue && <span className="text-xs text-slate-400">Prossima: <span className="font-medium">{fmtDate(nextDue.due_date)}</span></span>}
                            </>
                        )}
                    </div>

                    <div className="flex items-center gap-2.5 mt-2.5">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-emerald-500' : hasOverdue ? 'bg-red-400' : 'bg-primary-500'}`}
                                style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-gray-400 flex-shrink-0 tabular-nums w-8 text-right">{progressPct}%</span>
                        <span className="text-xs font-semibold text-slate-700 dark:text-gray-200 flex-shrink-0 tabular-nums">{fmt(paidTotal)}<span className="font-normal text-slate-400"> / {fmt(plan.total_amount)}</span></span>
                    </div>
                </div>

                <div className="flex-shrink-0 text-slate-300 dark:text-slate-600 group-hover:text-slate-500 dark:group-hover:text-slate-400 transition-colors ml-2">
                    {open ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </button>

            {open && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="flex justify-between text-xs px-1 pt-2 pb-1">
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">Incassato {fmt(paidTotal)}</span>
                        <span className="text-amber-600 dark:text-amber-400 font-medium">Rimanente {fmt(remainingTotal)}</span>
                    </div>
                    {installments.map((inst, i) => (
                        <InstallmentPill key={inst.id} inst={inst} index={i} onToggle={onToggle} saving={saving} />
                    ))}
                </div>
            )}
        </div>
    );
};

/* ─── Tabs ─────────────────────────────────────────────────── */
const TABS = [
    { id: 'all', label: 'Tutti', icon: <ListChecks size={14} /> },
    { id: 'active', label: 'In corso', icon: <Clock size={14} /> },
    { id: 'overdue', label: 'In ritardo', icon: <AlertTriangle size={14} /> },
    { id: 'done', label: 'Completati', icon: <CheckCircle size={14} /> },
] as const;
type TabId = typeof TABS[number]['id'];

/* ─── Mini bar chart ──────────────────────────────────────── */
const MiniBar: React.FC<{ data: { label: string; value: number; current?: boolean }[]; colorActive: string; colorInactive: string; emptyLabel: string }> = ({ data, colorActive, colorInactive, emptyLabel }) => {
    const max = Math.max(...data.map(d => d.value), 1);
    if (!data.some(d => d.value > 0)) return (
        <div className="flex items-center justify-center h-20 text-sm text-slate-400 dark:text-gray-500">{emptyLabel}</div>
    );
    return (
        <div className="flex items-end gap-1.5 h-20 px-1">
            {data.map(d => {
                const pct = Math.round((d.value / max) * 100);
                return (
                    <div key={d.label} className="flex-1 flex flex-col items-center gap-0.5 min-w-0">
                        <span className="text-slate-500 dark:text-gray-400 tabular-nums text-center leading-none" style={{ fontSize: '9px' }}>
                            {d.value > 0 ? fmt(d.value).replace(' €', '€') : ''}
                        </span>
                        <div className="w-full flex items-end" style={{ height: '44px' }}>
                            <div className={`w-full rounded-t-md transition-all duration-500 ${d.current ? colorActive : colorInactive}`}
                                style={{ height: d.value > 0 ? `${Math.max(pct, 8)}%` : '2px' }} />
                        </div>
                        <span className={`capitalize text-center leading-none ${d.current ? `font-bold ${colorActive.replace('bg-', 'text-')}` : 'text-slate-400 dark:text-gray-500'}`} style={{ fontSize: '9px' }}>{d.label}</span>
                    </div>
                );
            })}
        </div>
    );
};

/* ─── Main ──────────────────────────────────────────────────── */
const InstallmentsPage: React.FC = () => {
    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; total_paid: number }[]>([]);
    const [forecast, setForecast] = useState<{ month: string; expected: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('all');
    const [selectedMonth, setSelectedMonth] = useState<string | null>(monthStr(new Date()));

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, r, f] = await Promise.all([
                getPaymentPlans(),
                getInstallmentRevenueByMonth().catch(() => []),
                getInstallmentForecast(undefined, 6).catch(() => []),
            ]);
            setPlans(p);
            setRevenueByMonth(r);
            setForecast(f);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (inst: Installment) => {
        setSaving(true);
        try { await markInstallmentPaid(inst.id, inst.paid_at ? null : todayStr()); await load(); }
        finally { setSaving(false); }
    };

    const today = todayStr();
    const currentMonth = monthStr(new Date());

    const shiftMonth = (dir: -1 | 1) => {
        const base = selectedMonth || currentMonth;
        const [y, m] = base.split('-').map(Number);
        const next = new Date(y, m - 1 + dir, 1);
        setSelectedMonth(monthStr(next));
    };

    const plansInPeriod = useMemo(() => {
        if (!selectedMonth) return plans;
        return plans.filter(p => (p.installments || []).some(i => i.due_date.startsWith(selectedMonth)));
    }, [plans, selectedMonth]);

    const filteredPlans = useMemo(() => {
        const base = plansInPeriod;
        if (activeTab === 'active') return base.filter(p => (p.installments || []).some(i => !i.paid_at));
        if (activeTab === 'overdue') return base.filter(p => (p.installments || []).some(i => !i.paid_at && i.due_date < today));
        if (activeTab === 'done') return base.filter(p => (p.installments || []).every(i => i.paid_at) && (p.installments || []).length > 0);
        return base;
    }, [plansInPeriod, activeTab, today]);

    const stats = useMemo(() => {
        const curInsts = plans.flatMap(p => p.installments || []).filter(i => i.due_date.startsWith(currentMonth));
        const collected = curInsts.filter(i => i.paid_at).reduce((s, i) => s + i.amount, 0);
        const expected = curInsts.reduce((s, i) => s + i.amount, 0);
        const overdue = plans.flatMap(p => p.installments || []).filter(i => !i.paid_at && i.due_date < today);
        const completedPlans = plans.filter(p => (p.installments || []).length > 0 && (p.installments || []).every(i => i.paid_at));
        const filtInsts = selectedMonth
            ? plans.flatMap(p => p.installments || []).filter(i => i.due_date.startsWith(selectedMonth))
            : plans.flatMap(p => p.installments || []);
        const filtCollected = filtInsts.filter(i => i.paid_at).reduce((s, i) => s + i.amount, 0);
        const filtPending = filtInsts.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0);
        return { collected, expected, overdueCount: overdue.length, overdueTotal: overdue.reduce((s, i) => s + i.amount, 0), completedPlans: completedPlans.length, totalPlans: plans.length, filtCollected, filtPending };
    }, [plans, currentMonth, today, selectedMonth]);

    const historyData = useMemo(() => {
        const months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (5 - i));
            return monthStr(d);
        });
        return months.map(m => ({
            label: new Date(m + '-01').toLocaleDateString('it-IT', { month: 'short' }),
            value: revenueByMonth.find(r => r.month === m)?.total_paid || 0,
            current: m === currentMonth,
        }));
    }, [revenueByMonth, currentMonth]);

    const forecastData = useMemo(() => forecast.map(f => ({
        label: new Date(f.month + '-01').toLocaleDateString('it-IT', { month: 'short' }),
        value: f.expected,
        current: f.month === currentMonth,
    })), [forecast, currentMonth]);

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
        </div>
    );

    const isCurrentMonth = selectedMonth === currentMonth;
    const isAllMonths = selectedMonth === null;

    return (
        <div className="space-y-6 pb-10">

            {/* ── Header + selettore mese ── */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Pagamenti a rate</h1>
                    <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                        {isAllMonths
                            ? `${plans.length} piani totali`
                            : `${plansInPeriod.length} piani con rate in ${monthLabel(selectedMonth!)}`}
                    </p>
                </div>

                {/* Selettore mese */}
                <div className="flex items-center gap-2 self-start sm:self-auto">
                    {/* Bottone Tutti */}
                    <button
                        onClick={() => setSelectedMonth(null)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all border ${
                            isAllMonths
                                ? 'bg-primary-600 text-white border-primary-600 shadow-sm'
                                : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-gray-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                        }`}
                    >
                        Tutti
                    </button>

                    {/* Navigatore mese */}
                    <div className="flex items-center bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-sm overflow-hidden">
                        <button
                            onClick={() => shiftMonth(-1)}
                            disabled={isAllMonths}
                            className="px-2.5 py-2 text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronLeft size={15} />
                        </button>

                        <button
                            onClick={() => setSelectedMonth(currentMonth)}
                            className="px-3 py-1.5 text-xs font-semibold min-w-[120px] text-center transition-all hover:bg-slate-50 dark:hover:bg-slate-700 capitalize"
                        >
                            {isAllMonths ? (
                                <span className="text-slate-400">— mese —</span>
                            ) : (
                                <span className={isCurrentMonth ? 'text-primary-600 dark:text-primary-400' : 'text-slate-700 dark:text-gray-200'}>
                                    {monthLabel(selectedMonth!)}
                                </span>
                            )}
                        </button>

                        <button
                            onClick={() => shiftMonth(1)}
                            disabled={isAllMonths}
                            className="px-2.5 py-2 text-slate-400 hover:text-slate-700 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            </div>

            {/* ── StatCards ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<Euro size={22} />}
                    label={`Incassato — ${new Date().toLocaleDateString('it-IT', { month: 'long' })}`}
                    value={fmt(stats.collected)}
                    subValue={`Atteso questo mese: ${fmt(stats.expected)}`}
                    gradient="from-emerald-500 to-emerald-700"
                />
                <StatCard
                    icon={<TrendingUp size={22} />}
                    label={isAllMonths ? 'Da incassare — totale' : `Da incassare — ${new Date((selectedMonth || currentMonth) + '-01').toLocaleDateString('it-IT', { month: 'long' })}`}
                    value={fmt(stats.filtPending)}
                    subValue={`Già incassato: ${fmt(stats.filtCollected)}`}
                    gradient="from-primary-400 to-primary-600"
                />
                <StatCard
                    icon={<AlertTriangle size={22} />}
                    label="Rate scadute"
                    value={`${stats.overdueCount}`}
                    subValue={stats.overdueCount > 0 ? `${fmt(stats.overdueTotal)} da riscuotere` : 'Tutto in ordine'}
                    gradient={stats.overdueCount > 0 ? 'from-red-500 to-red-700' : 'from-slate-600 to-slate-800'}
                />
                <StatCard
                    icon={<CheckCircle size={22} />}
                    label="Piani completati"
                    value={`${stats.completedPlans} / ${stats.totalPlans}`}
                    subValue="tutti i pagamenti ricevuti"
                    gradient="from-slate-700 to-slate-900"
                />
            </div>

            {/* ── Grafici ── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Incassato — ultimi 6 mesi</p>
                        <span className="text-xs text-slate-400">Tot. <span className="font-semibold text-slate-600 dark:text-gray-300">{fmt(historyData.reduce((s, d) => s + d.value, 0))}</span></span>
                    </div>
                    <MiniBar data={historyData} colorActive="bg-primary-500" colorInactive="bg-primary-200 dark:bg-primary-900/30" emptyLabel="Nessun incasso ancora" />
                </div>

                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Proiezione — prossimi 6 mesi</p>
                        <span className="text-xs text-slate-400">Atteso <span className="font-semibold text-slate-600 dark:text-gray-300">{fmt(forecastData.reduce((s, d) => s + d.value, 0))}</span></span>
                    </div>
                    <MiniBar data={forecastData} colorActive="bg-teal-500" colorInactive="bg-teal-200 dark:bg-teal-900/30" emptyLabel="Nessuna rata futura" />
                </div>
            </div>

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1 w-fit">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-100 shadow-sm'
                                : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                        }`}>
                        {tab.icon}
                        {tab.label}
                        {tab.id === 'overdue' && stats.overdueCount > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold">{stats.overdueCount}</span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Lista piani ── */}
            {filteredPlans.length === 0 ? (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 py-16 text-center">
                    <div className="text-3xl mb-3">📋</div>
                    <p className="text-sm font-medium text-slate-600 dark:text-gray-300">
                        {activeTab === 'overdue' ? 'Nessuna rata in ritardo'
                        : activeTab === 'done' ? 'Nessun piano completato'
                        : activeTab === 'active' ? 'Nessun piano in corso'
                        : isAllMonths ? 'Nessun piano rate'
                        : `Nessun piano con rate in ${monthLabel(selectedMonth!)}`}
                    </p>
                    {activeTab === 'all' && isAllMonths && (
                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">Apri una lead → tab Preventivi → "Piano rate"</p>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {filteredPlans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} onToggle={handleToggle} saving={saving} defaultOpen={activeTab === 'overdue'} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default InstallmentsPage;
