import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    CheckCircle, Clock, AlertCircle, Euro, TrendingUp,
    AlertTriangle, ListChecks, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react';
import { getPaymentPlans, markInstallmentPaid, getInstallmentRevenueByMonth, getInstallmentForecast } from '@api/index';
import type { PaymentPlan, Installment } from '../../types';
import { useAuth } from '@contexts/AuthContext';

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

/* ─── InstallmentPill ─────────────────────────────────────── */
const InstallmentPill: React.FC<{
    inst: Installment;
    index: number;
    onToggle: (inst: Installment) => void;
    saving: boolean;
}> = ({ inst, index, onToggle, saving }) => {
    const today = todayStr();
    const overdue = !inst.paid_at && inst.due_date < today;
    const isThisMonth = inst.due_date.startsWith(thisMonthStr());

    return (
        <div className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
            inst.paid_at ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
            : overdue ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
            : isThisMonth ? 'border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10'
            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
        }`}>
            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                inst.paid_at ? 'bg-green-500 text-white'
                : overdue ? 'bg-red-400 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-gray-300'
            }`}>{index + 1}</span>

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-semibold text-sm text-slate-800 dark:text-gray-100">{fmt(inst.amount)}</span>
                    {isThisMonth && !inst.paid_at && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">Questo mese</span>
                    )}
                    {overdue && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">Scaduta</span>
                    )}
                </div>
                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                    {inst.paid_at
                        ? <>Incassata il <span className="font-medium text-green-600 dark:text-green-400">{fmtDate(inst.paid_at)}</span></>
                        : <>Scadenza: <span className={`font-medium ${overdue ? 'text-red-500' : ''}`}>{fmtDate(inst.due_date)}</span></>
                    }
                </p>
            </div>

            <button
                onClick={() => onToggle(inst)}
                disabled={saving}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 disabled:opacity-50 ${
                    inst.paid_at
                        ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-red-50 hover:border-red-300 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:border-red-700 dark:hover:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 text-slate-500 dark:text-gray-400 hover:bg-green-50 hover:border-green-400 hover:text-green-700 dark:hover:bg-green-900/20 dark:hover:border-green-600 dark:hover:text-green-400'
                }`}
            >
                {inst.paid_at ? <><CheckCircle size={11} /> Pagata</> : <><Clock size={11} /> Segna pagata</>}
            </button>
        </div>
    );
};

/* ─── PlanCard (collassabile) ─────────────────────────────── */
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

    const leadName = plan.leads?.data?.['Nome'] || plan.leads?.data?.['nome'] || '—';
    const leadService = plan.leads?.service || '';

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border-2 overflow-hidden transition-all ${
            isComplete ? 'border-green-200 dark:border-green-800'
            : hasOverdue ? 'border-red-200 dark:border-red-700'
            : 'border-slate-200 dark:border-slate-700'
        }`}>
            {/* Header — sempre visibile, cliccabile */}
            <button
                className="w-full px-5 py-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors text-left"
                onClick={() => setOpen(v => !v)}
            >
                {/* Dot stato */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isComplete ? 'bg-green-500' : hasOverdue ? 'bg-red-500' : 'bg-amber-400'
                }`} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-gray-100 truncate">{leadName}</span>
                        {leadService && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">{leadService}</span>
                        )}
                        {plan.quotes?.quote_number_display && (
                            <span className="text-xs text-slate-400">Prev. #{plan.quotes.quote_number_display}</span>
                        )}
                    </div>

                    {/* Riga riassuntiva sempre visibile */}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                        {isComplete ? (
                            <span className="text-xs font-semibold text-green-600 dark:text-green-400 flex items-center gap-1">
                                <CheckCircle size={12} /> Completato
                            </span>
                        ) : (
                            <>
                                <span className="text-xs text-slate-500 dark:text-gray-400">
                                    <span className="font-semibold text-green-600 dark:text-green-400">{paidList.length} pagate</span>
                                    {' · '}
                                    <span className={`font-semibold ${hasOverdue ? 'text-red-500' : 'text-slate-700 dark:text-gray-200'}`}>{unpaidList.length} mancanti</span>
                                    {' su '}<span className="font-semibold">{installments.length}</span>
                                </span>
                                {hasOverdue && (
                                    <span className="text-xs font-semibold text-red-500 dark:text-red-400 flex items-center gap-0.5">
                                        <AlertCircle size={11} /> {overdueList.length} scadut{overdueList.length === 1 ? 'a' : 'e'}
                                    </span>
                                )}
                                {nextDue && !hasOverdue && (
                                    <span className="text-xs text-slate-400">Prossima: <span className="font-medium">{fmtDate(nextDue.due_date)}</span></span>
                                )}
                            </>
                        )}
                    </div>

                    {/* Progress mini */}
                    <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-green-500' : hasOverdue ? 'bg-red-400' : 'bg-primary-500'}`}
                                style={{ width: `${progressPct}%` }} />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-gray-400 flex-shrink-0 tabular-nums">
                            {fmt(paidTotal)} / {fmt(plan.total_amount)}
                        </span>
                    </div>
                </div>

                <div className="flex-shrink-0 text-slate-400 ml-2">
                    {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </button>

            {/* Rate — espanse al click */}
            {open && (
                <div className="px-4 pb-4 pt-1 space-y-2 border-t border-slate-100 dark:border-slate-700">
                    <div className="flex justify-between text-xs text-slate-400 dark:text-gray-500 px-1 pt-1 pb-0.5">
                        <span className="text-green-600 dark:text-green-400 font-medium">Incassato {fmt(paidTotal)}</span>
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

/* ─── StatCard ────────────────────────────────────────────── */
const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = 'text-slate-800 dark:text-gray-100', icon }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center gap-3">
        <div className="p-2 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400 flex-shrink-0">{icon}</div>
        <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-gray-400 leading-tight">{label}</p>
            <p className={`text-lg font-bold truncate ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 dark:text-gray-500">{sub}</p>}
        </div>
    </div>
);

/* ─── Tabs ────────────────────────────────────────────────── */
const TABS = [
    { id: 'all', label: 'Tutti i piani', icon: <ListChecks size={14} /> },
    { id: 'active', label: 'In corso', icon: <Clock size={14} /> },
    { id: 'overdue', label: 'In ritardo', icon: <AlertTriangle size={14} /> },
    { id: 'done', label: 'Completati', icon: <CheckCircle size={14} /> },
] as const;
type TabId = typeof TABS[number]['id'];

/* ─── Main ────────────────────────────────────────────────── */
const InstallmentsPage: React.FC = () => {
    const { client } = useAuth() as any;
    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; total_paid: number }[]>([]);
    const [forecast, setForecast] = useState<{ month: string; expected: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('all');

    // Filtro periodo
    const [periodStart, setPeriodStart] = useState('');
    const [periodEnd, setPeriodEnd] = useState('');

    // Recupero clientId dall'URL se admin
    const clientId = client?.id;

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, r, f] = await Promise.all([
                getPaymentPlans(clientId),
                getInstallmentRevenueByMonth(clientId).catch(() => []),
                getInstallmentForecast(clientId, 6).catch(() => []),
            ]);
            setPlans(p);
            setRevenueByMonth(r);
            setForecast(f);
        } finally {
            setLoading(false);
        }
    }, [clientId]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (inst: Installment) => {
        const newVal = inst.paid_at ? null : todayStr();
        setSaving(true);
        try { await markInstallmentPaid(inst.id, newVal); await load(); }
        finally { setSaving(false); }
    };

    const today = todayStr();
    const thisMonth = thisMonthStr();

    // Piani filtrati per periodo: include un piano se ha almeno una rata nella finestra temporale
    const plansInPeriod = useMemo(() => {
        if (!periodStart && !periodEnd) return plans;
        return plans.filter(p =>
            (p.installments || []).some(i => {
                const d = i.due_date;
                return (!periodStart || d >= periodStart) && (!periodEnd || d <= periodEnd);
            })
        );
    }, [plans, periodStart, periodEnd]);

    const stats = useMemo(() => {
        const all = plansInPeriod.flatMap(p => {
            const insts = p.installments || [];
            if (!periodStart && !periodEnd) return insts;
            return insts.filter(i => (!periodStart || i.due_date >= periodStart) && (!periodEnd || i.due_date <= periodEnd));
        });
        const collectedThisMonth = plans.flatMap(p => p.installments || []).filter(i => i.paid_at?.startsWith(thisMonth)).reduce((s, i) => s + i.amount, 0);
        const expectedThisMonth = plans.flatMap(p => p.installments || []).filter(i => i.due_date.startsWith(thisMonth)).reduce((s, i) => s + i.amount, 0);
        const overdue = all.filter(i => !i.paid_at && i.due_date < today);
        const totalPending = all.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0);
        const completedPlans = plansInPeriod.filter(p => (p.installments || []).every(i => i.paid_at));
        const last6 = Array.from({ length: 6 }, (_, i) => {
            const d = new Date(); d.setMonth(d.getMonth() - (5 - i));
            return d.toISOString().slice(0, 7);
        });
        return { collectedThisMonth, expectedThisMonth, overdueCount: overdue.length, overdueTotal: overdue.reduce((s, i) => s + i.amount, 0), totalPending, completedPlans: completedPlans.length, last6 };
    }, [plansInPeriod, plans, today, thisMonth, periodStart, periodEnd]);

    const filteredPlans = useMemo(() => {
        const base = plansInPeriod;
        if (activeTab === 'active') return base.filter(p => (p.installments || []).some(i => !i.paid_at));
        if (activeTab === 'overdue') return base.filter(p => (p.installments || []).some(i => !i.paid_at && i.due_date < today));
        if (activeTab === 'done') return base.filter(p => (p.installments || []).length > 0 && (p.installments || []).every(i => i.paid_at));
        return base;
    }, [plansInPeriod, activeTab, today]);

    const monthLabel = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });
    const hasPeriod = !!(periodStart || periodEnd);

    const inputCls = 'px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500';

    return (
        <div className="space-y-5 pb-10">

            {/* ── Filtro periodo ── */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-4">
                <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-gray-300">
                        <Calendar size={16} className="text-primary-500" />
                        Filtra per periodo
                    </div>
                    <div className="flex items-center gap-2 flex-wrap flex-1">
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-gray-400">Da</label>
                            <input type="date" value={periodStart} onChange={e => setPeriodStart(e.target.value)} className={inputCls} />
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="text-xs text-slate-500 dark:text-gray-400">A</label>
                            <input type="date" value={periodEnd} onChange={e => setPeriodEnd(e.target.value)} className={inputCls} />
                        </div>
                        {hasPeriod && (
                            <button
                                onClick={() => { setPeriodStart(''); setPeriodEnd(''); }}
                                className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                            >
                                Rimuovi filtro
                            </button>
                        )}
                    </div>
                    {hasPeriod && (
                        <span className="text-xs text-slate-400 dark:text-gray-500">
                            {filteredPlans.length} piani nel periodo
                        </span>
                    )}
                </div>
            </div>

            {/* ── Stats ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard
                    label={`Incassato — ${monthLabel}`}
                    value={fmt(stats.collectedThisMonth)}
                    sub={`Atteso: ${fmt(stats.expectedThisMonth)}`}
                    color="text-green-600 dark:text-green-400"
                    icon={<Euro size={16} />}
                />
                <StatCard
                    label={hasPeriod ? 'Da incassare (periodo)' : 'Da incassare (totale)'}
                    value={fmt(stats.totalPending)}
                    sub={`${filteredPlans.filter(p => (p.installments||[]).some(i=>!i.paid_at)).length} piani attivi`}
                    color="text-amber-600 dark:text-amber-400"
                    icon={<TrendingUp size={16} />}
                />
                <StatCard
                    label="Rate in ritardo"
                    value={stats.overdueCount}
                    sub={stats.overdueCount > 0 ? fmt(stats.overdueTotal) : 'Tutto in ordine'}
                    color={stats.overdueCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-gray-400'}
                    icon={<AlertTriangle size={16} />}
                />
                <StatCard
                    label="Piani completati"
                    value={`${stats.completedPlans} / ${plansInPeriod.length}`}
                    sub="tutti i pagamenti ricevuti"
                    color="text-primary-600 dark:text-primary-400"
                    icon={<CheckCircle size={16} />}
                />
            </div>

            {/* ── Proiezione prossimi 6 mesi ── */}
            {forecast.some(f => f.expected > 0) && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center justify-between mb-3">
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Proiezione incassi — prossimi 6 mesi</p>
                        <span className="text-xs text-slate-400">Totale atteso: <span className="font-semibold text-slate-600 dark:text-gray-300">{fmt(forecast.reduce((s,f)=>s+f.expected,0))}</span></span>
                    </div>
                    <div className="flex items-end gap-2 h-24">
                        {forecast.map(f => {
                            const max = Math.max(...forecast.map(x => x.expected), 1);
                            const pct = Math.round((f.expected / max) * 100);
                            const lbl = new Date(f.month + '-01').toLocaleDateString('it-IT', { month: 'short' });
                            const isCurrent = f.month === thisMonth;
                            return (
                                <div key={f.month} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums text-center">
                                        {f.expected > 0 ? fmt(f.expected).replace(' €','€') : '—'}
                                    </span>
                                    <div className="w-full flex items-end" style={{ height: '52px' }}>
                                        <div className={`w-full rounded-t-lg ${isCurrent ? 'bg-teal-500' : 'bg-teal-200 dark:bg-teal-800/50'}`}
                                            style={{ height: f.expected > 0 ? `${Math.max(pct, 6)}%` : '2px' }} />
                                    </div>
                                    <span className={`text-xs capitalize ${isCurrent ? 'font-semibold text-teal-600 dark:text-teal-400' : 'text-slate-400'}`}>{lbl}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Storico ultimi 6 mesi ── */}
            {revenueByMonth.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-3">Incassato da rate — ultimi 6 mesi</p>
                    <div className="flex items-end gap-2 h-24">
                        {stats.last6.map(m => {
                            const val = revenueByMonth.find(r => r.month === m)?.total_paid || 0;
                            const max = Math.max(...stats.last6.map(mm => revenueByMonth.find(r => r.month === mm)?.total_paid || 0), 1);
                            const pct = Math.round((val / max) * 100);
                            const lbl = new Date(m + '-01').toLocaleDateString('it-IT', { month: 'short' });
                            const isCurrent = m === thisMonth;
                            return (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums text-center">
                                        {val > 0 ? fmt(val).replace(' €','€') : '—'}
                                    </span>
                                    <div className="w-full flex items-end" style={{ height: '52px' }}>
                                        <div className={`w-full rounded-t-lg ${isCurrent ? 'bg-primary-500' : 'bg-primary-200 dark:bg-primary-800/50'}`}
                                            style={{ height: val > 0 ? `${Math.max(pct, 6)}%` : '2px' }} />
                                    </div>
                                    <span className={`text-xs capitalize ${isCurrent ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-slate-400'}`}>{lbl}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1 w-fit">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-100 shadow-sm'
                                : 'text-slate-500 dark:text-gray-400 hover:text-slate-700'
                        }`}>
                        {tab.icon} {tab.label}
                        {tab.id === 'overdue' && stats.overdueCount > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold">
                                {stats.overdueCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Lista piani ── */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Caricamento…</div>
            ) : filteredPlans.length === 0 ? (
                <div className="text-center py-16 text-sm text-slate-400 dark:text-gray-500">
                    {activeTab === 'overdue' && 'Nessuna rata in ritardo.'}
                    {activeTab === 'done' && 'Nessun piano completato.'}
                    {activeTab === 'active' && 'Nessun piano attivo.'}
                    {activeTab === 'all' && (hasPeriod ? 'Nessun piano nel periodo selezionato.' : 'Nessun piano rate. Aprì una lead → tab Preventivi → "Piano rate".')}
                </div>
            ) : (
                <div className="space-y-3">
                    {activeTab === 'overdue' && (
                        <p className="text-xs text-slate-400 dark:text-gray-500 px-1">Clicca su un piano per vedere e gestire le rate</p>
                    )}
                    {filteredPlans.map(plan => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            onToggle={handleToggle}
                            saving={saving}
                            defaultOpen={activeTab === 'overdue'}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default InstallmentsPage;
