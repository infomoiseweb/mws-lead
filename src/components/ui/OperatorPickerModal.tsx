import React, { useState } from 'react';
import { Users, X, Check } from 'lucide-react';
import type { Operator } from '../../types';

interface OperatorPickerModalProps {
    isOpen: boolean;
    newStatus: string;
    operators: Operator[];
    onConfirm: (operator: Operator | null) => void;
    onCancel: () => void;
}

const COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

const OperatorPickerModal: React.FC<OperatorPickerModalProps> = ({
    isOpen, newStatus, operators, onConfirm, onCancel,
}) => {
    const [selected, setSelected] = useState<Operator | null>(null);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onCancel} />
            <div className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-sm p-6">
                <button onClick={onCancel} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition">
                    <X size={18} />
                </button>

                <div className="flex items-center gap-3 mb-1">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center">
                        <Users size={20} className="text-indigo-500" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-slate-800 dark:text-white">Chi ha eseguito questa azione?</h3>
                        <p className="text-xs text-slate-500 dark:text-gray-400">Stato → <span className="font-semibold text-slate-700 dark:text-gray-200">{newStatus}</span></p>
                    </div>
                </div>

                <div className="mt-4 space-y-2">
                    {operators.map(op => (
                        <button
                            key={op.id}
                            onClick={() => setSelected(selected?.id === op.id ? null : op)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all text-left ${
                                selected?.id === op.id
                                    ? 'border-indigo-400 bg-indigo-50 dark:bg-indigo-900/20'
                                    : 'border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-500'
                            }`}
                        >
                            <span className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: op.color }}>
                                {op.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="text-sm font-medium text-slate-700 dark:text-gray-200 flex-1">{op.name}</span>
                            {selected?.id === op.id && <Check size={16} className="text-indigo-500" />}
                        </button>
                    ))}
                </div>

                <div className="flex gap-3 mt-5">
                    <button
                        onClick={() => onConfirm(null)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition"
                    >
                        Salta
                    </button>
                    <button
                        onClick={() => onConfirm(selected)}
                        className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-indigo-500 hover:bg-indigo-600 text-white transition"
                    >
                        Conferma
                    </button>
                </div>
            </div>
        </div>
    );
};

export { COLORS };
export default OperatorPickerModal;
