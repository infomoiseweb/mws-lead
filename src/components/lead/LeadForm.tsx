import React, { useState, useEffect, useMemo } from 'react';
import type { Client, Lead, LeadField } from '../types';
import * as ApiService from '@api';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';

interface LeadFormProps {
    clients: Client[];
    client?: Client | null;
    onSuccess: () => void;
}

const LeadForm: React.FC<LeadFormProps> = ({ clients, client, onSuccess }) => {
    const { t } = useTranslation();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';

    const [selectedClientId, setSelectedClientId] = useState<string>(client?.id || (isAdmin && clients.length > 0 ? clients[0].id : ''));
    const [leadData, setLeadData] = useState<Record<string, string>>({});
    const [service, setService] = useState('');
    const [status, setStatus] = useState<Lead['status']>('Nuovo');
    const [value, setValue] = useState<number | ''>('');
    const [creationDate, setCreationDate] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const selectedClient = useMemo(() => {
        if (!isAdmin) return client || null;
        return clients.find(c => c.id === selectedClientId) || null;
    }, [selectedClientId, clients, isAdmin, client]);

    const realServices = useMemo(() => {
        return selectedClient ? selectedClient.services.filter(s => s.name !== '__default_fields__') : [];
    }, [selectedClient]);

    const currentService = useMemo(() => {
        return selectedClient?.services.find(s => s.name === service) || null;
    }, [selectedClient, service]);

    // Mostra solo i campi del servizio selezionato
    const allFields = useMemo(() => {
        return currentService?.fields || [];
    }, [currentService]);

    // Reset when client changes
    useEffect(() => {
        if (selectedClient) {
            const firstService = realServices[0]?.name || '';
            setService(firstService);
            setLeadData({});
            setStatus('Nuovo');
            setValue('');
            setCreationDate('');
            setError('');
        }
    }, [selectedClient]);

    // Reset form data when service changes
    useEffect(() => {
        setLeadData({});
        setError('');
    }, [service]);

    const handleDataChange = (fieldName: string, fieldValue: string) => {
        setLeadData(prev => ({ ...prev, [fieldName]: fieldValue }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientId) {
            setError(t('component_leadForm.select_client'));
            return;
        }

        const missingRequired = (currentService?.fields || []).filter((f: LeadField) => f.required && !leadData[f.name]?.trim());
        if (missingRequired.length > 0) {
            setError(`Il campo obbligatorio "${missingRequired[0].label}" non può essere vuoto.`);
            return;
        }

        setError('');
        setIsLoading(true);
        try {
            await ApiService.addLead({
                clientId: selectedClientId,
                leadData,
                service,
                status,
                value: value === '' ? undefined : Number(value),
                createdAt: creationDate || undefined,
            });
            onSuccess();
        } catch (err: any) {
            setError(err.message || t('generic_error'));
        } finally {
            setIsLoading(false);
        }
    };

    const inputCls = "block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white mt-1";
    const labelCls = "block text-sm font-medium text-slate-700 dark:text-gray-300";

    const renderField = (field: LeadField) => {
        const id = `lead-field-${field.name}`;
        const wrapCls = field.type === 'textarea' ? 'md:col-span-2' : '';
        return (
            <div key={field.id} className={wrapCls}>
                <label htmlFor={id} className={labelCls}>
                    {field.label}{field.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {field.type === 'textarea' ? (
                    <textarea id={id} value={leadData[field.name] || ''} onChange={e => handleDataChange(field.name, e.target.value)} className={inputCls} required={field.required} rows={3} />
                ) : field.type === 'select' ? (
                    <select id={id} value={leadData[field.name] || ''} onChange={e => handleDataChange(field.name, e.target.value)} className={inputCls} required={field.required}>
                        <option value="">Seleziona opzione...</option>
                        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                    </select>
                ) : field.type === 'radio' ? (
                    <div className="mt-2 space-y-2">
                        {field.options?.map(opt => (
                            <label key={opt} className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer">
                                <input type="radio" name={field.name} value={opt} checked={leadData[field.name] === opt} onChange={e => handleDataChange(field.name, e.target.value)} className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" required={field.required} />
                                <span>{opt}</span>
                            </label>
                        ))}
                    </div>
                ) : field.type === 'checkbox' ? (
                    <div className="mt-2">
                        <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-gray-300 cursor-pointer">
                            <input type="checkbox" checked={leadData[field.name] === 'true'} onChange={e => handleDataChange(field.name, e.target.checked ? 'true' : 'false')} className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500" />
                            <span>{field.label}</span>
                        </label>
                    </div>
                ) : (
                    <input type={field.type} id={id} value={leadData[field.name] || ''} onChange={e => handleDataChange(field.name, e.target.value)} className={inputCls} required={field.required} />
                )}
            </div>
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            {/* Selezione cliente (solo admin) e servizio */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isAdmin && (
                    <div>
                        <label htmlFor="client-select" className={labelCls}>{t('component_leadForm.client_label')}</label>
                        <select id="client-select" value={selectedClientId} onChange={e => setSelectedClientId(e.target.value)} required className={inputCls}>
                            <option value="" disabled>{t('component_leadForm.select_client')}</option>
                            {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                )}
                {selectedClient && realServices.length >= 1 && (
                    <div className={isAdmin ? '' : 'md:col-span-2'}>
                        <label htmlFor="service-select" className={labelCls}>{t('component_leadForm.service_label')}</label>
                        <select id="service-select" value={service} onChange={e => setService(e.target.value)} className={inputCls}>
                            {realServices.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                        </select>
                    </div>
                )}
            </div>

            {/* Tutti i campi del servizio selezionato */}
            {selectedClient && realServices.length > 0 && (
                <div key={service} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                    {allFields.map((field: LeadField) => renderField(field))}
                </div>
            )}

            {/* Nessun servizio configurato */}
            {selectedClient && realServices.length === 0 && (
                <div className="text-center p-6 border border-dashed border-slate-300 dark:border-slate-600 rounded-lg">
                    <p className="text-slate-500 dark:text-gray-400">{t('component_leadForm.no_services_or_fields')}</p>
                    <p className="text-sm text-slate-400 dark:text-gray-500">{t('component_leadForm.configure_in_clients')}</p>
                </div>
            )}

            {/* Metadati: stato, valore, data */}
            {selectedClient && realServices.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                        <label htmlFor="status-select" className={labelCls}>{t('component_leadForm.status_label')}</label>
                        <select id="status-select" value={status} onChange={e => setStatus(e.target.value as Lead['status'])} className={inputCls}>
                            <option value="Nuovo">{t('lead_status.Nuovo')}</option>
                            <option value="Contattato">{t('lead_status.Contattato')}</option>
                            <option value="In Lavorazione">{t('lead_status.In Lavorazione')}</option>
                            <option value="Perso">{t('lead_status.Perso')}</option>
                            <option value="Vinto">{t('lead_status.Vinto')}</option>
                        </select>
                    </div>
                    <div>
                        <label htmlFor="value-input" className={labelCls}>{t('component_leadForm.value_label')}</label>
                        <input type="number" id="value-input" value={value} onChange={e => setValue(e.target.value === '' ? '' : parseFloat(e.target.value))} className={inputCls} placeholder="0" min="0" />
                    </div>
                    <div className="md:col-span-2">
                        <label htmlFor="creation-date-input" className={labelCls}>{t('component_leadForm.registration_date_label')} ({t('optional')})</label>
                        <input type="date" id="creation-date-input" value={creationDate} onChange={e => setCreationDate(e.target.value)} className={inputCls} />
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">{t('component_leadForm.registration_date_hint')}</p>
                    </div>
                </div>
            )}

            {error && <p className="text-sm text-red-500 dark:text-red-400 text-center font-semibold">{error}</p>}

            <div className="flex justify-end pt-4 border-t border-slate-200 dark:border-slate-700">
                <button type="submit" disabled={isLoading || !selectedClient || realServices.length === 0} className="bg-primary-600 text-white px-4 py-2 rounded-lg shadow hover:bg-primary-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                    {isLoading ? t('component_leadForm.adding_lead') : t('component_leadForm.add_lead_button')}
                </button>
            </div>
        </form>
    );
};

export default LeadForm;
