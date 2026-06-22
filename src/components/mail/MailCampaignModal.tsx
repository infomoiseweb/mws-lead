import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import DateRangeFilter from '../ui/DateRangeFilter';
import * as ApiService from '@api';
import type { Client, MailCampaign, MailTemplate, Lead } from '../../types';
import { Loader2, Send } from 'lucide-react';

const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";

const LEAD_STATUSES: Lead['status'][] = ['Nuovo', 'Contattato', 'In Lavorazione', 'Preventivo Inviato', 'Preventivo Accettato', 'Preventivo Rifiutato', 'Vinto', 'Perso'];

interface MailCampaignModalProps {
    isOpen: boolean;
    onClose: () => void;
    campaign: MailCampaign | null;
    client: Client;
    templates: MailTemplate[];
    canSend: boolean;
    onSaved: (campaign: MailCampaign) => void;
}

const MailCampaignModal: React.FC<MailCampaignModalProps> = ({ isOpen, onClose, campaign, client, templates, canSend, onSaved }) => {
    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [subject, setSubject] = useState('');
    const [statuses, setStatuses] = useState<string[]>([]);
    const [services, setServices] = useState<string[]>([]);
    const [dateRange, setDateRange] = useState<{ start: Date | null; end: Date | null }>({ start: null, end: null });
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    const availableServices = (client.services || []).filter(s => s.name !== '__default_fields__').map(s => s.name);

    useEffect(() => {
        if (!isOpen) return;
        setError('');
        setSuccessMsg('');
        if (campaign) {
            setName(campaign.name);
            setTemplateId(campaign.template_id || '');
            setSubject(campaign.subject);
            setStatuses(campaign.filters?.statuses || []);
            setServices(campaign.filters?.services || []);
            setDateRange({
                start: campaign.filters?.created_after ? new Date(campaign.filters.created_after) : null,
                end: campaign.filters?.created_before ? new Date(campaign.filters.created_before) : null,
            });
        } else {
            const firstTemplate = templates[0];
            setName('');
            setTemplateId(firstTemplate?.id || '');
            setSubject(firstTemplate?.subject_template || '');
            setStatuses([]);
            setServices([]);
            setDateRange({ start: null, end: null });
        }
    }, [isOpen, campaign, templates]);

    const handleTemplateChange = (id: string) => {
        setTemplateId(id);
        if (!campaign) {
            const tpl = templates.find(t => t.id === id);
            if (tpl) setSubject(tpl.subject_template);
        }
    };

    const toggleInArray = (arr: string[], value: string, setter: (v: string[]) => void) => {
        if (arr.includes(value)) setter(arr.filter(v => v !== value));
        else setter([...arr, value]);
    };

    const buildFilters = () => ({
        ...(statuses.length > 0 ? { statuses } : {}),
        ...(services.length > 0 ? { services } : {}),
        ...(dateRange.start ? { created_after: dateRange.start.toISOString() } : {}),
        ...(dateRange.end ? { created_before: dateRange.end.toISOString() } : {}),
    });

    const persist = async (): Promise<MailCampaign> => {
        const saved = await ApiService.saveMailCampaign({
            ...(campaign ? { id: campaign.id } : {}),
            client_id: client.id,
            name: name.trim(),
            template_id: templateId || null,
            subject,
            filters: buildFilters(),
        });
        return saved;
    };

    const handleSaveDraft = async () => {
        if (!name.trim()) {
            setError('Inserisci un nome per la campagna.');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const saved = await persist();
            onSaved(saved);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Errore durante il salvataggio della campagna.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSendNow = async () => {
        if (!name.trim()) {
            setError('Inserisci un nome per la campagna.');
            return;
        }
        if (!templateId) {
            setError('Seleziona un template per la campagna.');
            return;
        }
        setIsSending(true);
        setError('');
        setSuccessMsg('');
        try {
            const saved = await persist();
            const sent = await ApiService.sendMailCampaign(saved.id);
            onSaved(sent);
            setSuccessMsg('Campagna inviata.');
            setTimeout(() => onClose(), 1200);
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'invio della campagna.');
        } finally {
            setIsSending(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={campaign ? 'Modifica campagna' : 'Nuova campagna'}
            size="large"
            footer={
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-2">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors order-3 sm:order-1">
                        Annulla
                    </button>
                    <button
                        onClick={handleSaveDraft}
                        disabled={isSaving || isSending}
                        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-gray-200 text-sm font-medium rounded-lg transition-colors order-2"
                    >
                        {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        Salva come bozza
                    </button>
                    {canSend && (
                        <button
                            onClick={handleSendNow}
                            disabled={isSaving || isSending}
                            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors order-1 sm:order-3"
                        >
                            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                            Invia ora
                        </button>
                    )}
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{error}</div>
                )}
                {successMsg && (
                    <div className="text-sm text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-md p-3">{successMsg}</div>
                )}
                {!canSend && (
                    <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3">
                        Per inviare campagne devi prima collegare e verificare un dominio email nella tab "Dominio".
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome campagna</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Promo giugno" className={inputCls} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Template</label>
                        <select value={templateId} onChange={e => handleTemplateChange(e.target.value)} className={inputCls}>
                            <option value="">Seleziona un template...</option>
                            {templates.map(tpl => (
                                <option key={tpl.id} value={tpl.id}>{tpl.name}</option>
                            ))}
                        </select>
                        {templates.length === 0 && (
                            <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">Crea prima un template nella sezione qui sopra.</p>
                        )}
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Oggetto email</label>
                    <input type="text" value={subject} onChange={e => setSubject(e.target.value)} placeholder="Es. {{brand_name}}: una novità per te" className={inputCls} />
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                    <h4 className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-2">Destinatari (segmento lead)</h4>
                    <p className="text-xs text-slate-400 dark:text-gray-500 mb-2">Lascia vuoto per includere tutte le lead. Vengono escluse automaticamente le lead senza email valida e quelle che hanno annullato l'iscrizione.</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1">Stato lead</label>
                            <div className="flex flex-wrap gap-1.5">
                                {LEAD_STATUSES.map(status => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => toggleInArray(statuses, status, setStatuses)}
                                        className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                            statuses.includes(status)
                                                ? 'bg-primary-600 text-white border-primary-600'
                                                : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-slate-600'
                                        }`}
                                    >
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {availableServices.length > 0 && (
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1">Servizio</label>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableServices.map(service => (
                                        <button
                                            key={service}
                                            type="button"
                                            onClick={() => toggleInArray(services, service, setServices)}
                                            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                                                services.includes(service)
                                                    ? 'bg-primary-600 text-white border-primary-600'
                                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-slate-600'
                                            }`}
                                        >
                                            {service}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-3">
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400 block mb-1">Data di arrivo della lead</label>
                        <DateRangeFilter onDateChange={setDateRange} />
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default MailCampaignModal;
