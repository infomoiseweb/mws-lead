import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, Clock, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { getPaymentPlans, markInstallmentPaid } from '@api/index';
import type { PaymentPlan, Installment } from '../../types';
import { useAuth } from '@contexts/AuthContext';

const fmt = (n: number) =>
    n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

const today = () => new Date().toISOString().slice(0, 10);

const thisMonth = () => new Date().toISOString().slice(0, 7); // YYYY-MM

interface PlanCardProps {
    plan: PaymentPlan;
    onTogglePaid: (inst: Installment) => void;
    saving: boolean;
}

const PlanCard: React.FC<PlanCardProps> = ({ plan, onTogglePaid, saving }) => {
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
    const isOverdueNext = nextUnpaid && nextUnpaid.due_date < today();

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div
                className="px-5 py-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                onClick={() => setExpanded(e => !e)}
            >
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
                    <div className="flex items-center gap-3 mt-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                                className="h-full rounded-full bg-green-500 transition-all duration-500"
                                style={{ width: `${progressPct}%` }}
                            />
                        </div>
                        <span className="text-xs font-medium text-slate-500 dark:text-gray-400 flex-shrink-0">
                            {progressPct}% · {fmt(paidTotal)} / {fmt(plan.total_amount)}
                        </span>
                    </div>
                    {nextUnpaid && (
                        <p className={`text-xs mt-1 ${isOverdueNext ? 'text-red-500 dark:text-red-400 font-medium' : 'text-slate-500 dark:text-gray-400'}`}>
                            {isOverdueNext ? '⚠ Scaduta: ' : 'Prossima: '}
                            {fmt(nextUnpaid.amount)} — {fmtDate(nextUnpaid.due_date)}
                        </p>
                    )}
                    {unpaid.length === 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400 font-medium mt-1">✓ Pagamento completato</p>
                    )}
                </div>
                <div className="ml-4 flex-shrink-0 text-slate-400">
                    {expanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </div>
            </div>

            {/* Expanded installments */}
            {expanded && (
                <div className="border-t border-slate-100 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                    {installments.map(inst => {
                        const overdue = !inst.paid_at && inst.due_date < today();
                        const isThisMonth = inst.due_date.startsWith(thisMonth());
                        return (
                            <div
                                key={inst.id}
                                className={`flex items-center gap-4 px-5 py-3 ${
                                    inst.paid_at
                                        ? 'bg-green-50 dark:bg-green-900/10'
                                        : overdue
                                        ? 'bg-red-50 dark:bg-red-900/10'
                                        : ''
                                }`}
                            >
                                <button
                                    onClick={() => onTogglePaid(inst)}
                                    disabled={saving}
                                    title={inst.paid_at ? 'Segna come non pagata' : 'Segna come pagata'}
                                    className="flex-shrink-0"
                                >
                                    {inst.paid_at ? (
                                        <CheckCircle size={20} className="text-green-500" />
                                    ) : overdue ? (
                                        <AlertCircle size={20} className="text-red-400" />
                                    ) : (
                                        <Clock size={20} className="text-slate-300 dark:text-slate-600" />
                                    )}
                                </button>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-semibold text-slate-800 dark:text-gray-100">{fmt(inst.amount)}</span>
                                        {isThisMonth && !inst.paid_at && (
                                            <span className="text-xs px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 font-medium">
                                                Questo mese
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-500 dark:text-gray-400">
                                        Scadenza: {fmtDate(inst.due_date)}
                                        {inst.paid_at && ` · Pagato il ${fmtDate(inst.paid_at)}`}
                                    </p>
                                    {inst.notes && <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">{inst.notes}</p>}
                                </div>
                                <div className="flex-shrink-0 text-right">
                                    {inst.paid_at ? (
                                        <span className="text-xs text-green-600 dark:text-green-400 font-medium">Pagata</span>
                                    ) : overdue ? (
                                        <span className="text-xs text-red-500 dark:text-red-400 font-medium">Scaduta</span>
                                    ) : (
                                        <span className="text-xs text-slate-400">In attesa</span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

const InstallmentsPage: React.FC = () => {
    const { client } = useAuth();
    const [plans, setPlans] = useState<PaymentPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [filter, setFilter] = useState<'all' | 'active' | 'overdue' | 'completed'>('all');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await getPaymentPlans(client?.id);
            setPlans(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [client?.id]);

    useEffect(() => { load(); }, [load]);

    const handleTogglePaid = async (inst: Installment) => {
        const newVal = inst.paid_at ? null : today();
        setSaving(true);
        try {
            await markInstallmentPaid(inst.id, newVal);
            await load();
        } finally {
            setSaving(false);
        }
    };

    const todayStr = today();
    const filtered = plans.filter(plan => {
        const installments = plan.installments || [];
        const unpaid = installments.filter(i => !i.paid_at);
        const overdue = unpaid.some(i => i.due_date < todayStr);
        if (filter === 'completed') return unpaid.length === 0;
        if (filter === 'overdue') return overdue;
        if (filter === 'active') return unpaid.length > 0 && !overdue;
        return true;
    });

    // Stats
    const totalPlans = plans.length;
    const completedPlans = plans.filter(p => (p.installments || []).every(i => i.paid_at)).length;
    const overduePlans = plans.filter(p => (p.installments || []).some(i => !i.paid_at && i.due_date < todayStr)).length;
    const totalPending = plans.reduce((s, p) =>
        s + (p.installments || []).filter(i => !i.paid_at).reduce((ss, i) => ss + i.amount, 0), 0);

    const filterBtns: { key: typeof filter; label: string }[] = [
        { key: 'all', label: 'Tutti' },
        { key: 'active', label: 'Attivi' },
        { key: 'overdue', label: 'Scaduti' },
        { key: 'completed', label: 'Completati' },
    ];

    return (
        <div className="space-y-6">
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                    { label: 'Piani totali', value: totalPlans, color: 'text-slate-800 dark:text-gray-100' },
                    { label: 'Completati', value: completedPlans, color: 'text-green-600 dark:text-green-400' },
                    { label: 'Con scadenze arretrate', value: overduePlans, color: 'text-red-500 dark:text-red-400' },
                    { label: 'Totale da incassare', value: fmt(totalPending), color: 'text-amber-600 dark:text-amber-400' },
                ].map(s => (
                    <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 px-4 py-3">
                        <p className="text-xs text-slate-500 dark:text-gray-400 mb-1">{s.label}</p>
                        <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                    </div>
                ))}
            </div>

            {/* Filters */}
            <div className="flex gap-2 flex-wrap">
                {filterBtns.map(b => (
                    <button
                        key={b.key}
                        onClick={() => setFilter(b.key)}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                            filter === b.key
                                ? 'bg-primary-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-gray-300 hover:border-primary-400'
                        }`}
                    >
                        {b.label}
                    </button>
                ))}
            </div>

            {/* List */}
            {loading ? (
                <div className="text-center py-16 text-slate-400">Caricamento…</div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-16">
                    <p className="text-slate-400 dark:text-gray-500">
                        {plans.length === 0
                            ? 'Nessun piano rate. Aprì una lead "Vinta" e clicca "Piano rate" nella sezione Preventivi.'
                            : 'Nessun piano rate corrisponde al filtro selezionato.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map(plan => (
                        <PlanCard key={plan.id} plan={plan} onTogglePaid={handleTogglePaid} saving={saving} />
                    ))}
                </div>
            )}
        </div>
    );
};

export default InstallmentsPage;
