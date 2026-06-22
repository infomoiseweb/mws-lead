import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import * as ApiService from '@api';
import type { MailAutomation, MailTemplate, Lead } from '../../types';
import { Loader2 } from 'lucide-react';

const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";

const LEAD_STATUSES: Lead['status'][] = ['Nuovo', 'Contattato', 'In Lavorazione', 'Preventivo Inviato', 'Preventivo Accettato', 'Preventivo Rifiutato', 'Vinto', 'Perso'];

interface MailAutomationModalProps {
    isOpen: boolean;
    onClose: () => void;
    automation: MailAutomation | null;
    clientId: string;
    templates: MailTemplate[];
    onSaved: (automation: MailAutomation) => void;
}

const MailAutomationModal: React.FC<MailAutomationModalProps> = ({ isOpen, onClose, automation, clientId, templates, onSaved }) => {
    const [name, setName] = useState('');
    const [triggerType, setTriggerType] = useState<MailAutomation['trigger_type']>('lead_created');
    const [triggerStatus, setTriggerStatus] = useState<string>('Perso');
    const [delayHours, setDelayHours] = useState(48);
    const [templateId, setTemplateId] = useState('');
    const [active, setActive] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        if (automation) {
            setName(automation.name);
            setTriggerType(automation.trigger_type);
            setTriggerStatus(automation.trigger_status || 'Perso');
            setDelayHours(automation.delay_hours);
            setTemplateId(automation.template_id || '');
            setActive(automation.active);
        } else {
            setName('');
            setTriggerType('lead_created');
            setTriggerStatus('Perso');
            setDelayHours(48);
            setTemplateId(templates[0]?.id || '');
            setActive(true);
        }
    }, [isOpen, automation, templates]);

    const handleSave = async () => {
        if (!name.trim()) { setError('Inserisci un nome per l\'automazione.'); return; }
        if (!templateId) { setError('Seleziona un template.'); return; }
        if (delayHours < 0) { setError('Il ritardo non può essere negativo.'); return; }

        setIsSaving(true);
        setError('');
        try {
            const saved = await ApiService.saveMailAutomation({
                ...(automation ? { id: automation.id } : {}),
                client_id: clientId,
                name: name.trim(),
                trigger_type: triggerType,
                trigger_status: triggerType === 'lead_status_changed' ? triggerStatus : null,
                delay_hours: delayHours,
                template_id: templateId,
                active,
            });
            onSaved(saved);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Errore durante il salvataggio dell\'automazione.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={automation ? 'Modifica automazione' : 'Nuova automazione'}
            footer={
                <div className="flex items-center justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Annulla
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Salva
                    </button>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{error}</div>
                )}

                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome automazione</label>
                    <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Follow-up nuove lead" className={inputCls} />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Evento</label>
                        <select value={triggerType} onChange={e => setTriggerType(e.target.value as MailAutomation['trigger_type'])} className={inputCls}>
                            <option value="lead_created">Quando una lead arriva</option>
                            <option value="lead_status_changed">Quando una lead cambia stato</option>
                        </select>
                    </div>
                    {triggerType === 'lead_status_changed' && (
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Stato lead</label>
                            <select value={triggerStatus} onChange={e => setTriggerStatus(e.target.value)} className={inputCls}>
                                {LEAD_STATUSES.map(status => (
                                    <option key={status} value={status}>{status}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">
                            Ritardo (ore dopo l'evento)
                        </label>
                        <input
                            type="number"
                            min={0}
                            value={delayHours}
                            onChange={e => setDelayHours(Math.max(0, parseInt(e.target.value, 10) || 0))}
                            className={inputCls}
                        />
                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                            {delayHours === 0
                                ? "L'email verrà inviata appena viene rilevata la lead."
                                : `L'email verrà inviata circa ${delayHours} ore dopo${triggerType === 'lead_created' ? " l'arrivo della lead." : " il cambio di stato."}`}
                        </p>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Template</label>
                        <select value={templateId} onChange={e => setTemplateId(e.target.value)} className={inputCls}>
                            <option value="">Seleziona un template...</option>
                            {templates.map(tpl => (
                                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                            ))}
                        </select>
                        {templates.length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Crea prima un template nella tab "Campagne".</p>
                        )}
                    </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={active} onChange={e => setActive(e.target.checked)} className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500" />
                    <span className="text-sm text-slate-600 dark:text-gray-300">Automazione attiva</span>
                </label>
            </div>
        </Modal>
    );
};

export default MailAutomationModal;
