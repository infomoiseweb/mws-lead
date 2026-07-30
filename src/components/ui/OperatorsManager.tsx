import React, { useEffect, useState } from 'react';
import { getOperators, addOperator, updateOperator, deleteOperator } from '@api/operators';
import type { Operator } from '../../types';
import { COLORS } from './OperatorPickerModal';
import { Plus, Trash2, Check, X, Edit, Users } from 'lucide-react';

interface OperatorsManagerProps {
    clientId: string;
}

const OperatorsManager: React.FC<OperatorsManagerProps> = ({ clientId }) => {
    const [operators, setOperators] = useState<Operator[]>([]);
    const [loading, setLoading] = useState(true);
    const [addingName, setAddingName] = useState('');
    const [addingColor, setAddingColor] = useState(COLORS[0]);
    const [addingOpen, setAddingOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [editColor, setEditColor] = useState('');

    const load = () => {
        setLoading(true);
        getOperators(clientId).then(setOperators).finally(() => setLoading(false));
    };

    useEffect(() => { load(); }, [clientId]);

    const handleAdd = async () => {
        if (!addingName.trim()) return;
        setSaving(true);
        try {
            await addOperator(clientId, addingName.trim(), addingColor);
            setAddingName('');
            setAddingColor(COLORS[0]);
            setAddingOpen(false);
            load();
        } finally {
            setSaving(false);
        }
    };

    const handleSaveEdit = async (id: string) => {
        if (!editName.trim()) return;
        setSaving(true);
        try {
            await updateOperator(id, editName.trim(), editColor);
            setEditingId(null);
            load();
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Eliminare questo operatore? Le azioni già registrate rimarranno.')) return;
        await deleteOperator(id);
        load();
    };

    if (loading) return (
        <div className="flex justify-center py-12">
            <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
    );

    return (
        <div className="max-w-lg">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <Users size={18} className="text-indigo-500" />
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">Gestione Operatori</h3>
                </div>
                <button
                    type="button"
                    onClick={() => setAddingOpen(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold transition"
                >
                    <Plus size={15} /> Aggiungi
                </button>
            </div>

            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">
                Gli operatori vengono selezionati quando si cambia lo stato di una lead, per tracciare chi ha eseguito l'azione.
            </p>

            {addingOpen && (
                <div className="mb-4 p-4 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/20">
                    <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-2">Nuovo operatore</p>
                    <div className="flex items-center gap-2 mb-3">
                        <input
                            autoFocus
                            value={addingName}
                            onChange={e => setAddingName(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAdd()}
                            placeholder="Nome operatore"
                            className="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                        />
                    </div>
                    <div className="flex gap-2 mb-3">
                        {COLORS.map(c => (
                            <button
                                type="button"
                                key={c}
                                onClick={() => setAddingColor(c)}
                                className={`w-7 h-7 rounded-full border-2 transition ${addingColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}
                                style={{ backgroundColor: c }}
                            />
                        ))}
                    </div>
                    <div className="flex gap-2">
                        <button type="button" onClick={handleAdd} disabled={saving || !addingName.trim()} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50 transition">
                            <Check size={14} /> Salva
                        </button>
                        <button type="button" onClick={() => { setAddingOpen(false); setAddingName(''); }} className="px-3 py-1.5 rounded-lg text-sm text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                            Annulla
                        </button>
                    </div>
                </div>
            )}

            {operators.length === 0 ? (
                <div className="text-center py-10 text-slate-400 dark:text-slate-500 text-sm">
                    Nessun operatore. Aggiungine uno per iniziare.
                </div>
            ) : (
                <div className="space-y-2">
                    {operators.map(op => (
                        <div key={op.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                            {editingId === op.id ? (
                                <>
                                    <span
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                        style={{ backgroundColor: editColor }}
                                    >
                                        {editName.charAt(0).toUpperCase() || '?'}
                                    </span>
                                    <input
                                        autoFocus
                                        value={editName}
                                        onChange={e => setEditName(e.target.value)}
                                        className="flex-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                    />
                                    <div className="flex gap-1">
                                        {COLORS.map(c => (
                                            <button type="button" key={c} onClick={() => setEditColor(c)}
                                                className={`w-5 h-5 rounded-full border-2 transition ${editColor === c ? 'border-slate-800 dark:border-white scale-110' : 'border-transparent'}`}
                                                style={{ backgroundColor: c }}
                                            />
                                        ))}
                                    </div>
                                    <button type="button" onClick={() => handleSaveEdit(op.id)} disabled={saving} className="p-1.5 rounded-lg text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition">
                                        <Check size={15} />
                                    </button>
                                    <button type="button" onClick={() => setEditingId(null)} className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition">
                                        <X size={15} />
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span
                                        className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                        style={{ backgroundColor: op.color }}
                                    >
                                        {op.name.charAt(0).toUpperCase()}
                                    </span>
                                    <span className="flex-1 text-sm font-medium text-slate-700 dark:text-gray-200">{op.name}</span>
                                    <button type="button" onClick={() => { setEditingId(op.id); setEditName(op.name); setEditColor(op.color); }}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition">
                                        <Edit size={15} />
                                    </button>
                                    <button type="button" onClick={() => handleDelete(op.id)}
                                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition">
                                        <Trash2 size={15} />
                                    </button>
                                </>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default OperatorsManager;
