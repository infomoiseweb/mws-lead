import React, { useEffect, useState, useCallback, useMemo } from 'react';
import {
    CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp,
    TrendingUp, Euro, CalendarClock, ListChecks, AlertTriangle,
} from 'lucide-react';
import {
    getPaymentPlans,
    markInstallmentPaid,
    getInstallmentRevenueByMonth,
} from '@api/index';
import type { PaymentPlan, Installment } from '../../types';
import { useAuth } from '@contexts/AuthContext';

/* ─── helpers ─────────────────────────────────────────────── */

const fmt = (n: number) =>
    n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const fmtDate = (d: string) =>
    new Date(d + 'T00:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

const todayStr = () => new Date().toISOString().slice(0, 10);
const thisMonthStr = () => new Date().toISOString().slice(0, 7); // YYYY-MM

/* ─── sub-components ──────────────────────────────────────── */

interface PlanCardProps {
    plan: PaymentPlan;
    onTogglePaid: (inst: Installment, plan: PaymentPlan) => void;
    saving: boolean;
    highlightMonth?: string; // YYYY-MM — evidenzia le rate di quel mese
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onTogglePaid, saving, highlightMonth }) => {
    const [expanded, setExpanded] = useState(false);

    const installments = (plan.installments || []).slice().sort((a, b) => a.due_date.localeCompare(b.due_date));
    const paid = installments.filter(i => i.paid_at);
    const unpaid = installments.filter(i => !i.paid_at);
    const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
    const progressPct = plan.total_amount > 0
        ? Math.min(100, Math.round((paidTotal / plan.total_amount) * 100))
        : 0;

    const leadName = plan.leads?.data?.['Nome'] || plan.leads?.data?.['nome'] || '—';
    const leadService = plan.leads?.service || '';
    const nextUnpaid = unpaid[0];
    const isOverdueNext = nextUnpaid && nextUnpaid.due_date < todayStr();
    const isComplete = unpaid.length === 0;

    return (
        <div className={`bg-white dark:bg-slate-800 rounded-2xl border overflow-hidden transition-all ${
            isComplete ? 'border-green-200 dark:border-green-800'
            : isOverdueNext ? 'border-red-200 dark:border-red-700'
            : 'border-slate-200 dark:border-slate-700'
        }`}>
            <div
                className="px-5 py-4 flex items-center gap-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
                {/* Status dot */}
                <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                    isComplete ? 'bg-green-500'
                    : isOverdueNext ? 'bg-red-500'
                    : 'bg-amber-400'
                }`} />

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-800 dark:text-gray-100 truncate">{leadName}</span>
                        {leadService && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">
                                {leadService}
                            </span>
                        )}
                        {plan.quotes?.quote_number_display && (
                            <span className="text-xs text-primary-600 dark:text-primary-400">
                                Prev. #{plan.quotes.quote_number_display}
                            </span>
                        )}
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                                className={`h-full rounded-full transition-all duration-500 ${isComplete ? 'bg-green-500' : 'bg-primary-500'}`}
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-gray-400 flex-shrink-0 tabular-nums">
                            {fmt(paidTotal)} / {fmt(plan.total_amount)}
                        </span>
                    </div>

                    {/* Status line */}
                    {isComplete ? (
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">✓ Pagamento completato</p>
                    ) : nextUnpaid ? (
                        <p className={`text-xs mt-1 ${isOverdueNext ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-500 dark:text-gray-400'}`}>
                            {isOverdueNext ? '⚠ Scaduta: ' : 'Prossima: '}{fmt(nextUnpaid.amount)} — {fmtDate(nextUnpaid.due_date)}
                        </p>
                    ) : null}
                </div>

                <div className="flex-shrink-0 text-slate-400">
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60">
                    {installments.map(inst => {
                        const overdue = !inst.paid_at && inst.due_date < todayStr();
                        const isThisHighlightMonth = highlightMonth && inst.due_date.startsWith(highlightMonth);
                        const paidThisMonth = inst.paid_at && inst.paid_at.startsWith(thisMonthStr());

                        return (
                            <div
                                key={inst.id}
                                className={`flex items-center gap-4 px-5 py-3 ${
                                    inst.paid_at ? 'bg-green-50 dark:bg-green-900/10'
                                    : overdue ? 'bg-red-50 dark:bg-red-900/10'
                                    : isThisHighlightMonth ? 'bg-amber-50 dark:bg-amber-900/10'
                                    : ''
                                }`}
                            >
                                <button
                                    onClick={e => { e.stopPropagation(); onTogglePaid(inst, plan); }}
                                    disabled={saving}
                                    title={inst.paid_at ? 'Segna come non pagata' : 'Segna come pagata'}
                                    className="flex-shrink-0"
                                >
                                    {inst.paid_at
                                        ? <CheckCircle size={20} className="text-green-500" />
                                        : overdue
                                        ? <AlertCircle size={20} className="text-red-400" />
                                        : <Clock size={20} className="text-slate-300 dark:text-slate-600" />}
                                </button>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-semibold text-slate-800 dark:text-gray-100">{fmt(inst.amount)}</span>
                                        {isThisHighlightMonth && !inst.paid_at && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                                                Questo mese
                                            </span>
                                        )}
                                        {paidThisMonth && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 font-medium">
                                                Pagata questo mese
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                        Scadenza: {fmtDate(inst.due_date)}
                                        {inst.paid_at && ` · Incassata il ${fmtDate(inst.paid_at)}`}
                                    </p>
                                </div>

                                <span className={`text-xs font-medium flex-shrink-0 ${
                                    inst.paid_at ? 'text-green-600 dark:text-green-400'
                                    : overdue ? 'text-red-500 dark:text-red-400'
                                    : 'text-slate-400'
                                }`}>
                                    {inst.paid_at ? 'Pagata' : overdue ? 'Scaduta' : 'In attesa'}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

/* ─── stat card ───────────────────────────────────────────── */

const StatCard: React.FC<{ label: string; value: string | number; sub?: string; color?: string; icon: React.ReactNode }> = ({ label, value, sub, color = 'text-slate-800 dark:text-gray-100', icon }) => (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 px-5 py-4 flex items-center gap-4">
        <div className="p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">{icon}</div>
        <div>
            <p className="text-xs text-slate-500 dark:text-gray-400">{label}</p>
            <p className={`text-xl font-bold mt-0.5 ${color}`}>{value}</p>
            {sub && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{sub}</p>}
        </div>
    </div>
);

/* ─── main page ───────────────────────────────────────────── */

const TABS = [
    { id: 'month', label: 'Questo mese', icon: <CalendarClock size={15} /> },
    { id: 'all', label: 'Tutti i piani', icon: <ListChecks size={15} /> },
    { id: 'overdue', label: 'In ritardo', icon: <AlertTriangle size={15} /> },
] as const;

type TabId = typeof TABS[number]['id'];

const InstallmentsPage: React.FC = () => {
    const { client } = useAuth();
    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [revenueByMonth, setRevenueByMonth] = useState<{ month: string; total_paid: number }[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<TabId>('month');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [p, r] = await Promise.all([
                getPaymentPlans(client?.id),
                getInstallmentRevenueByMonth(client?.id),
            ]);
            setPlans(p);
            setRevenueByMonth(r);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [client?.id]);

    useEffect(() => { load(); }, [load]);

    const handleTogglePaid = async (inst: Installment, _plan: PaymentPlan) => {
        const newVal = inst.paid_at ? null : todayStr();
        setSaving(true);
        try {
            await markInstallmentPaid(inst.id, newVal);
            await load();
        } finally {
            setSaving(false);
        }
    };

    /* ── computed ── */
    const today = todayStr();
    const thisMonth = thisMonthStr();

    const stats = useMemo(() => {
        const allInstallments = plans.flatMap(p => p.installments || []);

        const paidThisMonth = allInstallments.filter(i => i.paid_at?.startsWith(thisMonth));
        const dueThisMonth = allInstallments.filter(i => i.due_date.startsWith(thisMonth));
        const overdue = allInstallments.filter(i => !i.paid_at && i.due_date < today);
        const totalPending = allInstallments.filter(i => !i.paid_at).reduce((s, i) => s + i.amount, 0);
        const collectedThisMonth = paidThisMonth.reduce((s, i) => s + i.amount, 0);
        const expectedThisMonth = dueThisMonth.reduce((s, i) => s + i.amount, 0);
        const completedPlans = plans.filter(p => (p.installments || []).every(i => i.paid_at));

        // Fatturato cumulativo da rate per tutti i mesi
        const last6Months = Array.from({ length: 6 }, (_, i) => {
            const d = new Date();
            d.setMonth(d.getMonth() - (5 - i));
            return d.toISOString().slice(0, 7);
        });

        return {
            collectedThisMonth,
            expectedThisMonth,
            overdueCount: overdue.length,
            overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
            totalPending,
            completedPlans: completedPlans.length,
            activePlans: plans.length - completedPlans.length,
            last6Months,
        };
    }, [plans, today, thisMonth]);

    const filteredPlans = useMemo(() => {
        if (activeTab === 'month') {
            return plans.filter(p =>
                (p.installments || []).some(i => i.due_date.startsWith(thisMonth) || (i.paid_at && i.paid_at.startsWith(thisMonth)))
            );
        }
        if (activeTab === 'overdue') {
            return plans.filter(p =>
                (p.installments || []).some(i => !i.paid_at && i.due_date < today)
            );
        }
        return plans;
    }, [plans, activeTab, thisMonth, today]);

    const monthLabel = new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6 pb-10">

            {/* ── Stats grid ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label={`Incassato — ${monthLabel}`}
                    value={fmt(stats.collectedThisMonth)}
                    sub={`Atteso: ${fmt(stats.expectedThisMonth)}`}
                    color="text-green-600 dark:text-green-400"
                    icon={<Euro size={18} />}
                />
                <StatCard
                    label="Totale da incassare"
                    value={fmt(stats.totalPending)}
                    sub={`${stats.activePlans} piani attivi`}
                    color="text-amber-600 dark:text-amber-400"
                    icon={<TrendingUp size={18} />}
                />
                <StatCard
                    label="Rate in ritardo"
                    value={stats.overdueCount}
                    sub={stats.overdueCount > 0 ? fmt(stats.overdueTotal) : 'Nessuna scadenza arretrata'}
                    color={stats.overdueCount > 0 ? 'text-red-500 dark:text-red-400' : 'text-slate-800 dark:text-gray-100'}
                    icon={<AlertTriangle size={18} />}
                />
                <StatCard
                    label="Piani completati"
                    value={stats.completedPlans}
                    sub={`su ${plans.length} totali`}
                    color="text-primary-600 dark:text-primary-400"
                    icon={<CheckCircle size={18} />}
                />
            </div>

            {/* ── Revenue mini-chart (ultimi 6 mesi) ── */}
            {revenueByMonth.length > 0 && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5">
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-4">Incassato da rate — ultimi 6 mesi</p>
                    <div className="flex items-end gap-3 h-24">
                        {stats.last6Months.map(m => {
                            const entry = revenueByMonth.find(r => r.month === m);
                            const val = entry?.total_paid || 0;
                            const max = Math.max(...stats.last6Months.map(mm => revenueByMonth.find(r => r.month === mm)?.total_paid || 0), 1);
                            const pct = Math.round((val / max) * 100);
                            const label = new Date(m + '-01').toLocaleDateString('it-IT', { month: 'short' });
                            return (
                                <div key={m} className="flex-1 flex flex-col items-center gap-1">
                                    <span className="text-xs text-slate-500 dark:text-gray-400 tabular-nums">
                                        {val > 0 ? fmt(val).replace('€', '').trim() : '—'}
                                    </span>
                                    <div className="w-full flex items-end justify-center" style={{ height: '52px' }}>
                                        <div
                                            className={`w-full rounded-t-md transition-all duration-500 ${m === thisMonthStr() ? 'bg-primary-500' : 'bg-primary-200 dark:bg-primary-800'}`}
                                            style={{ height: `${Math.max(pct, val > 0 ? 8 : 0)}%` }}
                                        />
                                    </div>
                                    <span className="text-xs text-slate-400 dark:text-gray-500 capitalize">{label}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* ── Tabs ── */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700/50 rounded-xl p-1 w-fit">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                            activeTab === tab.id
                                ? 'bg-white dark:bg-slate-800 text-slate-800 dark:text-gray-100 shadow-sm'
                                : 'text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                        }`}
                    >
                        {tab.icon} {tab.label}
                        {tab.id === 'overdue' && stats.overdueCount > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400 font-bold">
                                {stats.overdueCount}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Tab content ── */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Caricamento…</div>
            ) : filteredPlans.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-400 dark:text-gray-500">
                        {activeTab === 'month' && 'Nessuna rata prevista o incassata questo mese.'}
                        {activeTab === 'overdue' && 'Nessuna rata in ritardo. '}
                        {activeTab === 'all' && 'Nessun piano rate. Aprì una lead e clicca "Piano rate" nella sezione Preventivi.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {activeTab === 'month' && (
                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">
                            Piani con rate in scadenza o pagate in <span className="font-medium capitalize">{monthLabel}</span>
                        </p>
                    )}
                    {filteredPlans.map(plan => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            onTogglePaid={handleTogglePaid}
                            saving={saving}
                            highlightMonth={activeTab === 'month' ? thisMonth : undefined}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default InstallmentsPage;
