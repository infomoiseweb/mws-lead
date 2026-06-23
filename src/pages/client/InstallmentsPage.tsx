import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    CheckCircle, Clock, AlertCircle, Euro, TrendingUp,
    AlertTriangle, CalendarClock, ListChecks, ChevronDown, ChevronUp,
} from 'lucide-react';
import { getPaymentPlans, markInstallmentPaid, getInstallmentRevenueByMonth, getInstallmentForecast } from '@api/index';
import type { PaymentPlan, Installment } from '../../types';
import { useAuth } from '@contexts/AuthContext';

/* ─── helpers ─────────────────────────────────────────────── */
const fmt = (n: number) => n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
const fmtDate = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });
const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonthStr = () => new Date().toISOString().slice(0, 7);

/* ─── Installment pill ────────────────────────────────────── */
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
        <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
            inst.paid_at
                ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/10'
                : overdue
                ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/10'
                : isThisMonth
                ? 'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60'
        }`}>
            {/* Numero rata */}
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                inst.paid_at ? 'bg-green-500 text-white'
                : overdue ? 'bg-red-400 text-white'
                : 'bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-gray-300'
            }`}>
                {index + 1}
            </span>

            {/* Importo + scadenza */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-800 dark:text-gray-100">{fmt(inst.amount)}</span>
                    {isThisMonth && !inst.paid_at && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 font-medium">
                            Questo mese
                        </span>
                    )}
                    {overdue && (
                        <span className="text-xs px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-medium">
                            Scaduta
                        </span>
                    )}
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                    {inst.paid_at
                        ? <>Pagata il <span className="font-medium">{fmtDate(inst.paid_at)}</span></>
                        : <>Scadenza: <span className={`font-medium ${overdue ? 'text-red-500 dark:text-red-400' : ''}`}>{fmtDate(inst.due_date)}</span></>
                    }
                </p>
            </div>

            {/* Toggle pagamento */}
            <button
                onClick={() => onToggle(inst)}
                disabled={saving}
                title={inst.paid_at ? 'Segna come non pagata' : 'Segna come pagata'}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex-shrink-0 ${
                    inst.paid_at
                        ? 'border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 hover:bg-red-50 dark:hover:bg-red-900/20 hover:border-red-300 dark:hover:border-red-700 hover:text-red-600 dark:hover:text-red-400'
                        : 'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 hover:border-green-400 dark:hover:border-green-600 hover:text-green-700 dark:hover:text-green-400'
                } disabled:opacity-50`}
            >
                {inst.paid_at
                    ? <><CheckCircle size={13} /> Pagata</>
                    : <><Clock size={13} /> Segna pagata</>
                }
            </button>
        </div>
    );
};

/* ─── Plan card ───────────────────────────────────────────── */
const PlanCard: React.FC<{ plan: PaymentPlan; onToggle: (inst: Installment) => void; saving: boolean }> = ({ plan, onToggle, saving }) => {
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

    const [showAll, setShowAll] = useState(false);
    const visibleInstallments = showAll ? installments : installments.slice(0, 3);
    const hasMore = installments.length > 3;

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border-2 overflow-hidden ${
            isComplete ? 'border-green-300 dark:border-green-700'
            : hasOverdue ? 'border-red-300 dark:border-red-700'
            : 'border-slate-200 dark:border-slate-700'
        }`}>
            {/* ── Header ── */}
            <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-slate-800 dark:text-gray-100 text-base">{leadName}</span>
                            {leadService && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 font-medium">
                                    {leadService}
                                </span>
                            )}
                            {plan.quotes?.quote_number_display && (
                                <span className="text-xs text-slate-400 dark:text-gray-500">
                                    Prev. #{plan.quotes.quote_number_display}
                                </span>
                            )}
                        </div>

                        {/* Stato sintetico */}
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                            {isComplete ? (
                                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-600 dark:text-green-400">
                                    <CheckCircle size={13} /> Pagamento completato
                                </span>
                            ) : (
                                <>
                                    <span className="text-xs text-slate-500 dark:text-gray-400">
                                        <span className="font-semibold text-green-600 dark:text-green-400">{paidList.length} pagate</span>
                                        {' · '}
                                        <span className={`font-semibold ${hasOverdue ? 'text-red-500 dark:text-red-400' : 'text-slate-700 dark:text-gray-200'}`}>
                                            {unpaidList.length} mancanti
                                        </span>
                                        {' su '}
                                        <span className="font-semibold">{installments.length} totali</span>
                                    </span>
                                    {hasOverdue && (
                                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-500 dark:text-red-400">
                                            <AlertCircle size={12} />
                                            {overdueList.length} {overdueList.length === 1 ? 'scaduta' : 'scadute'}
                                        </span>
                                    )}
                                    {nextDue && !hasOverdue && (
                                        <span className="text-xs text-slate-500 dark:text-gray-400">
                                            Prossima: <span className="font-medium">{fmtDate(nextDue.due_date)}</span>
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>

                    {/* Importi */}
                    <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-500 dark:text-gray-400">Totale piano</p>
                        <p className="text-lg font-bold text-slate-800 dark:text-gray-100">{fmt(plan.total_amount)}</p>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="mt-4">
                    <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400 mb-1.5">
                        <span>Incassato <span className="font-semibold text-green-600 dark:text-green-400">{fmt(paidTotal)}</span></span>
                        <span>Rimanente <span className="font-semibold text-amber-600 dark:text-amber-400">{fmt(remainingTotal)}</span></span>
                    </div>
                    <div className="w-full h-3 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                        <div
                            className={`h-full rounded-full transition-all duration-700 ${isComplete ? 'bg-green-500' : hasOverdue ? 'bg-red-400' : 'bg-primary-500'}`}
                            style={{ width: `${progressPct}%` }}
                        />
                    </div>
                    <p className="text-right text-xs font-medium text-slate-400 dark:text-gray-500 mt-1">{progressPct}%</p>
                </div>
            </div>

            {/* ── Installments list ── */}
            <div className="p-4 space-y-2">
                {visibleInstallments.map((inst, i) => (
                    <InstallmentPill
                        key={inst.id}
                        inst={inst}
                        index={i}
                        onToggle={onToggle}
                        saving={saving}
                    />
                ))}

                {hasMore && (
                    <button
                        onClick={() => setShowAll(v => !v)}
                        className="w-full py-2 flex items-center justify-center gap-1.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-800 font-medium transition-colors"
                    >
                        {showAll ? <><ChevronUp size={15} /> Mostra meno</> : <><ChevronDown size={15} /> Mostra tutte le {installments.length} rate</>}
                    </button>
                )}
            </div>
        </div>
    );
};

/* ─── Stat card ───────────────────────────────────────────── */
const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = 'text-slate-800 dark:text-gray-100', icon }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400 flex-shrink-0">{icon}</div>
        <div className="min-w-0">
            <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
            <p className={`text-xl font-bold mt-0.5 truncate ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
    </div>
);

/* ─── Main page ───────────────────────────────────────────── */
const TABS = [
    { id: 'all', label: 'Tutti i piani', icon: <ListChecks size={14} /> },
    { id: 'active', label: 'In corso', icon: <Clock size={14} /> },
    { id: 'overdue', label: 'In ritardo', icon: <AlertTriangle size={14} /> },
    { id: 'done', label: 'Completati', icon: <CheckCircle size={14} /> },
] as const;
type TabId = typeof TABS[number]['id'];

const InstallmentsPage: React.FC = () => {
    const { client } = useAuth();
    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; total_paid: number }[]>([]);
    const [forecast, setForecast] = useState<{ month: string; expected: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, r, f] = await Promise.all([
                getPaymentPlans(client?.id),
                getInstallmentRevenueByMonth(client?.id).catch(() => []),
                getInstallmentForecast(client?.id, 6).catch(() => []),
            ]);
            setPlans(p);
            setRevenueByMonth(r);
            setForecast(f);
        } finally {
            setLoading(false);
        }
    }, [client?.id]);

    useEffect(() => { load(); }, [load]);

    const handleToggle = async (inst: Installment) => {
        const newVal = inst.paid_at ? null : todayStr();
        setSaving(true);
        try { await markInstallmentPaid(inst.id, newVal); await load(); }
        finally { setSaving(false); }
    };

    const today = todayStr();
    const thisMonth = thisMonthStr();

    const stats = useMemo(() => {
        const all = plans.flatMap(p => p.installments || []);
        const collectedThisMonth = all.filter(i => i.paid_at?.startsWith(thisMonth)).reduce((s, i) => s + i.amount, 0);
        const expectedThisMonth = all.filter(i => i.due_date.startsWith(thisMonth)).reduce((s, i) => s + i.amount, 0);
        const overdue = all.filter(i => !i.paid_at && i.due_date < today);
        const totalPending = all.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0);
        const completedPlans = plans.filter(p => (p.installments || []).length > 0 && (p.installments || []).every(i => i.paid_at));
        const activePlans = plans.filter(p => (p.installments || []).some(i => !i.paid_at));
        const last6 = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            return d.toISOString().slice(0, 7);
        });
        return { collectedThisMonth, expectedThisMonth, overdueCount: overdue.length, overdueTotal: overdue.reduce((s, i) => s + i.amount, 0), totalPending, completedPlans: completedPlans.length, activePlans: activePlans.length, last6 };
    }, [plans, today, thisMonth]);

    const filteredPlans = useMemo(() => {
        if (activeTab === 'active') return plans.filter(p => (p.installments || []).some(i => !i.paid_at));
        if (activeTab === 'overdue') return plans.filter(p => (p.installments || []).some(i => !i.paid_at && i.due_date < today));
        if (activeTab === 'done') return plans.filter(p => (p.installments || []).length > 0 && (p.installments || []).every(i => i.paid_at));
        return plans;
    }, [plans, activeTab, today]);

    const monthLabel = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6 pb-10">

            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label={`Incassato — ${monthLabel}`} value={fmt(stats.collectedThisMonth)}
                    sub={`Atteso: ${fmt(stats.expectedThisMonth)}`} color="text-green-600 dark:text-green-400" icon={<Euro size={18} />} />
                <StatCard label="Da incassare (totale)" value={fmt(stats.totalPending)}
                    sub={`${stats.activePlans} piani attivi`} color="text-amber-600 dark:text-amber-400" icon={<TrendingUp size={18} />} />
                <StatCard label="Rate in ritardo" value={stats.overdueCount}
                    sub={stats.overdueCount > 0 ? fmt(stats.overdueTotal) : 'Tutto in ordine'}
                    color={stats.overdueCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-500 dark:text-gray-400'} icon={<AlertTriangle size={18} />} />
                <StatCard label="Piani completati" value={`${stats.completedPlans} / ${plans.length}`}
                    sub="tutti i pagamenti ricevuti" color="text-primary-600 dark:text-primary-400" icon={<CheckCircle size={18} />} />
            </div>

            {/* Proiezione prossimi 6 mesi */}
            {forecast.some(f => f.expected > 0) && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <div className="flex items-center justify-between mb-4">
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Proiezione incassi — prossimi 6 mesi</p>
                        <span className="text-xs text-slate-400 dark:text-gray-500">Solo rate non ancora pagate</span>
                    </div>
                    <div className="flex items-end gap-2 h-32">
                        {forecast.map(f => {
                            const max = Math.max(...forecast.map(x => x.expected), 1);
                            const pct = Math.round((f.expected / max) * 100);
                            const lbl = new Date(f.month + '-01').toLocaleDateString('it-IT', { month: 'short' });
                            const isCurrent = f.month === thisMonthStr();
                            return (
                                <div key={f.month} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums text-center leading-tight">
                                        {f.expected > 0 ? fmt(f.expected).replace(' €', '€') : '—'}
                                    </span>
                                    <div className="w-full flex items-end" style={{ height: '72px' }}>
                                        <div
                                            className={`w-full rounded-t-lg transition-all duration-700 ${isCurrent ? 'bg-teal-500' : 'bg-teal-200 dark:bg-teal-800/60'}`}
                                            style={{ height: f.expected > 0 ? `${Math.max(pct, 6)}%` : '2px' }}
                                        />
                                    </div>
                                    <span className={`text-xs capitalize ${isCurrent ? 'font-semibold text-teal-600 dark:text-teal-400' : 'text-slate-400 dark:text-gray-500'}`}>{lbl}</span>
                                </div>
                            );
                        })}
                    </div>
                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-3 text-center">
                        Totale atteso nei prossimi 6 mesi: <span className="font-semibold text-slate-700 dark:text-gray-200">{fmt(forecast.reduce((s, f) => s + f.expected, 0))}</span>
                    </p>
                </div>
            )}

            {/* Mini grafico ultimi 6 mesi */}
            {revenueByMonth.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Incassato da rate — ultimi 6 mesi</p>
                    <div className="flex items-end gap-2 h-28">
                        {stats.last6.map(m => {
                            const val = revenueByMonth.find(r => r.month === m)?.total_paid || 0;
                            const max = Math.max(...stats.last6.map(mm => revenueByMonth.find(r => r.month === mm)?.total_paid || 0), 1);
                            const pct = Math.round((val / max) * 100);
                            const lbl = new Date(m + '-01').toLocaleDateString('it-IT', { month: 'short' });
                            const isCurrent = m === thisMonth;
                            return (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums text-center leading-tight">
                                        {val > 0 ? fmt(val).replace(' €', '€') : '—'}
                                    </span>
                                    <div className="w-full flex items-end" style={{ height: '60px' }}>
                                        <div className={`w-full rounded-t-lg transition-all duration-700 ${isCurrent ? 'bg-primary-500' : 'bg-primary-200 dark:bg-primary-800/60'}`}
                                            style={{ height: val > 0 ? `${Math.max(pct, 6)}%` : '2px' }} />
                                    </div>
                                    <span className={`text-xs capitalize ${isCurrent ? 'font-semibold text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-gray-500'}`}>{lbl}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1 w-fit">
                {TABS.map(tab => (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-100 shadow-sm'
                                : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.icon} {tab.label}
                        {tab.id === 'overdue' && stats.overdueCount > 0 && (
                            <span className="ml-0.5 px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold">
                                {stats.overdueCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-20 text-slate-400">Caricamento…</div>
            ) : filteredPlans.length === 0 ? (
                <div className="text-center py-20">
                    <p className="text-slate-400 dark:text-gray-500 text-sm">
                        {activeTab === 'overdue' && 'Nessuna rata in ritardo. '}
                        {activeTab === 'done' && 'Nessun piano completato. '}
                        {activeTab === 'active' && 'Nessun piano attivo. '}
                        {activeTab === 'all' && 'Nessun piano rate. Aprì una lead e clicca "Piano rate" nella sezione Preventivi.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-5">
                    {filteredPlans.map(plan => (
                        <PlanCard key={plan.id} plan={plan} onToggle={handleToggle} saving={saving} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default InstallmentsPage;
