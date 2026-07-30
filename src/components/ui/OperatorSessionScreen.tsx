import React from 'react';
import type { Operator } from '../../types';
import { Users } from 'lucide-react';

interface OperatorSessionScreenProps {
    operators: Operator[];
    clientName: string;
    onSelect: (operator: Operator) => void;
}

const OperatorSessionScreen: React.FC<OperatorSessionScreenProps> = ({ operators, clientName, onSelect }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-100 dark:bg-slate-900">
            <div className="w-full max-w-md mx-auto px-6">
                {/* Logo / intestazione */}
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center mx-auto mb-4">
                        <Users size={30} className="text-indigo-500" />
                    </div>
                    <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Chi sta lavorando?</h1>
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-1">
                        Seleziona il tuo profilo per tracciare le azioni su <span className="font-semibold text-slate-700 dark:text-gray-200">{clientName}</span>
                    </p>
                </div>

                {/* Lista operatori */}
                <div className="space-y-3">
                    {operators.map(op => (
                        <button
                            key={op.id}
                            onClick={() => onSelect(op)}
                            className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl bg-white dark:bg-slate-800 border-2 border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 hover:shadow-md transition-all group"
                        >
                            <span
                                className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg font-bold flex-shrink-0 shadow-sm"
                                style={{ backgroundColor: op.color }}
                            >
                                {op.name.charAt(0).toUpperCase()}
                            </span>
                            <span className="flex-1 text-left text-base font-semibold text-slate-700 dark:text-gray-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors">
                                {op.name}
                            </span>
                            <span className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-400 transition-colors text-xl">→</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default OperatorSessionScreen;
