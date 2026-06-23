import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, CheckCircle, Clock, AlertCircle, ChevronDown } from 'lucide-react';
import {
    getPaymentPlanByLead,
    createPaymentPlan,
    deletePaymentPlan,
    markInstallmentPaid,
    addInstallment,
    deleteInstallment,
    updateInstallment,
} from '@api/index';
import type { PaymentPlan, Installment, Lead, Client } from '../../types';

interface Props {
    lead: Lead;
    client: Client;
    onClose: () => void;
}

const fmt = (n: number) =>
    n.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const fmtDate = (d: string) =>
    new Date(d).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });

const today = () => new Date().toISOString().slice(0, 10);

interface InstallmentRow {
    id?: string;
    amount: string;
    due_date: string;
    notes: string;
    paid_at: string | null;
}

export const PaymentPlanModal: React.FC<Props> = ({ lead, client, onClose }) => {
    const [plan, setPlan] = useState<PaymentPlan | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Form for creating a new plan
    const [totalAmount, setTotalAmount] = useState('');
    const [notes, setNotes] = useState('');
    const [rows, setRows] = useState<InstallmentRow[]>([
        { amount: '', due_date: today(), notes: '', paid_at: null },
    ]);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const p = await getPaymentPlanByLead(lead.id);
            setPlan(p);
            if (p) {
                setTotalAmount(String(p.total_amount));
                setNotes(p.notes || '');
            }
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [lead.id]);

    useEffect(() => { load(); }, [load]);

    const handleCreate = async () => {
        const parsed = rows.map(r => ({
            amount: parseFloat(r.amount.replace(',', '.')) || 0,
            due_date: r.due_date,
            notes: r.notes || undefined,
        }));
        const total = parsed.reduce((s, r) => s + r.amount, 0);
        setSaving(true);
        setError('');
        try {
            await createPaymentPlan({
                client_id: client.id,
                lead_id: lead.id,
                total_amount: parseFloat(totalAmount.replace(',', '.')) || total,
                notes: notes || undefined,
                installments: parsed,
            });
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!plan || !confirm('Eliminare il piano rate? L\'operazione è irreversibile.')) return;
        setSaving(true);
        try {
            await deletePaymentPlan(plan.id);
            setPlan(null);
            setRows([{ amount: '', due_date: today(), notes: '', paid_at: null }]);
            setTotalAmount('');
            setNotes('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleTogglePaid = async (inst: Installment) => {
        const newVal = inst.paid_at ? null : today();
        setSaving(true);
        try {
            await markInstallmentPaid(inst.id, newVal);
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleAddRow = async () => {
        if (!plan) {
            setRows(prev => [...prev, { amount: '', due_date: today(), notes: '', paid_at: null }]);
            return;
        }
        setSaving(true);
        try {
            await addInstallment(plan.id, { amount: 0, due_date: today() });
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteInstallment = async (id: string) => {
        setSaving(true);
        try {
            await deleteInstallment(id);
            await load();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSaving(false);
        }
    };

    const handleInstallmentUpdate = async (inst: Installment, field: 'amount' | 'due_date' | 'notes', value: string) => {
        const updates: any = { [field]: field === 'amount' ? parseFloat(value.replace(',', '.')) || 0 : value };
        try {
            await updateInstallment(inst.id, updates);
            await load();
        } catch (e: any) {
            setError(e.message);
        }
    };

    const installments = plan?.installments ?? [];
    const paid = installments.filter(i => i.paid_at);
    const unpaid = installments.filter(i => !i.paid_at);
    const paidTotal = paid.reduce((s, i) => s + i.amount, 0);
    const unpaidTotal = unpaid.reduce((s, i) => s + i.amount, 0);
    const progressPct = plan && plan.total_amount > 0
        ? Math.round((paidTotal / plan.total_amount) * 100)
        : 0;

    const inputCls = 'w-full px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-primary-500';

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-800 dark:text-gray-100">Piano rate</h2>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            {lead.data?.['Nome'] || lead.data?.['nome'] || lead.id.slice(0, 8)}
                        </p>
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400">
                        <X size={18} />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {loading ? (
                        <p className="text-center text-slate-400 py-8">Caricamento…</p>
                    ) : plan ? (
                        <>
                            {/* Progress */}
                            <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-700/50 space-y-3">
                                <div className="flex justify-between items-center">
                                    <span className="text-sm font-medium text-slate-600 dark:text-gray-300">Avanzamento pagamento</span>
                                    <span className="text-sm font-bold text-slate-800 dark:text-gray-100">{progressPct}%</span>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-slate-200 dark:bg-slate-600 overflow-hidden">
                                    <div
                                        className="h-full rounded-full bg-green-500 transition-all duration-500"
                                        style={{ width: `${progressPct}%` }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-slate-500 dark:text-gray-400">
                                    <span className="text-green-600 dark:text-green-400 font-medium">Pagato: {fmt(paidTotal)}</span>
                                    <span>Totale: {fmt(plan.total_amount)}</span>
                                    <span className="text-amber-600 dark:text-amber-400 font-medium">Mancante: {fmt(unpaidTotal)}</span>
                                </div>
                            </div>

                            {/* Rate list */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Rate ({installments.length})</h3>
                                    <button
                                        onClick={handleAddRow}
                                        disabled={saving}
                                        className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-800 font-medium"
                                    >
                                        <Plus size={14} /> Aggiungi rata
                                    </button>
                                </div>

                                <div className="space-y-2">
                                    {installments
                                        .slice()
                                        .sort((a, b) => a.due_date.localeCompare(b.due_date))
                                        .map((inst, idx) => {
                                            const isOverdue = !inst.paid_at && inst.due_date < today();
                                            return (
                                                <div
                                                    key={inst.id}
                                                    className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
                                                        inst.paid_at
                                                            ? 'border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20'
                                                            : isOverdue
                                                            ? 'border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20'
                                                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
                                                    }`}
                                                >
                                                    <button
                                                        onClick={() => handleTogglePaid(inst)}
                                                        disabled={saving}
                                                        title={inst.paid_at ? 'Segna come non pagata' : 'Segna come pagata'}
                                                        className="flex-shrink-0"
                                                    >
                                                        {inst.paid_at ? (
                                                            <CheckCircle size={20} className="text-green-500" />
                                                        ) : isOverdue ? (
                                                            <AlertCircle size={20} className="text-red-400" />
                                                        ) : (
                                                            <Clock size={20} className="text-slate-300 dark:text-slate-600" />
                                                        )}
                                                    </button>

                                                    <div className="flex-1 grid grid-cols-2 gap-2 min-w-0">
                                                        <input
                                                            type="text"
                                                            defaultValue={String(inst.amount).replace('.', ',')}
                                                            onBlur={e => handleInstallmentUpdate(inst, 'amount', e.target.value)}
                                                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm font-medium text-slate-800 dark:text-gray-100"
                                                            placeholder="Importo €"
                                                        />
                                                        <input
                                                            type="date"
                                                            defaultValue={inst.due_date}
                                                            onBlur={e => handleInstallmentUpdate(inst, 'due_date', e.target.value)}
                                                            className="px-2 py-1 rounded border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm text-slate-800 dark:text-gray-100"
                                                        />
                                                    </div>

                                                    <div className="flex-shrink-0 text-right">
                                                        {inst.paid_at && (
                                                            <p className="text-xs text-green-600 dark:text-green-400">
                                                                Pagato {fmtDate(inst.paid_at)}
                                                            </p>
                                                        )}
                                                    </div>

                                                    <button
                                                        onClick={() => handleDeleteInstallment(inst.id)}
                                                        disabled={saving}
                                                        className="flex-shrink-0 p-1 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400 transition-colors"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>

                            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

                            <button
                                onClick={handleDelete}
                                disabled={saving}
                                className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 underline"
                            >
                                Elimina piano rate
                            </button>
                        </>
                    ) : (
                        /* Create new plan */
                        <div className="space-y-5">
                            <p className="text-sm text-slate-600 dark:text-gray-300">
                                Nessun piano rate per questa lead. Creane uno definendo l'importo totale e le singole rate.
                            </p>

                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1">
                                    Importo totale (€)
                                </label>
                                <input
                                    type="text"
                                    value={totalAmount}
                                    onChange={e => setTotalAmount(e.target.value)}
                                    onFocus={e => e.target.select()}
                                    placeholder="Es. 1500"
                                    className={inputCls}
                                />
                                <p className="text-xs text-slate-400 mt-1">Lascia vuoto per calcolare automaticamente dalla somma delle rate.</p>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Rate</label>
                                    <button
                                        type="button"
                                        onClick={handleAddRow}
                                        className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 font-medium"
                                    >
                                        <Plus size={13} /> Aggiungi rata
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    {rows.map((row, i) => (
                                        <div key={i} className="flex gap-2 items-center">
                                            <input
                                                type="text"
                                                value={row.amount}
                                                onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, amount: e.target.value } : r))}
                                                onFocus={e => e.target.select()}
                                                placeholder="Importo €"
                                                className={`${inputCls} flex-1`}
                                            />
                                            <input
                                                type="date"
                                                value={row.due_date}
                                                onChange={e => setRows(prev => prev.map((r, j) => j === i ? { ...r, due_date: e.target.value } : r))}
                                                className={`${inputCls} flex-1`}
                                            />
                                            {rows.length > 1 && (
                                                <button
                                                    onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}
                                                    className="p-1 text-slate-300 hover:text-red-500 dark:text-slate-600 dark:hover:text-red-400"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1">Note (opzionale)</label>
                                <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Es. Pagamento a 3 rate mensili" className={inputCls} />
                            </div>

                            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
                        </div>
                    )}
                </div>

                {!plan && !loading && (
                    <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
                        <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700">
                            Annulla
                        </button>
                        <button
                            onClick={handleCreate}
                            disabled={saving || rows.every(r => !r.amount)}
                            className="px-5 py-2 text-sm rounded-lg bg-primary-600 text-white font-medium hover:bg-primary-700 disabled:opacity-50"
                        >
                            {saving ? 'Salvataggio…' : 'Crea piano rate'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
