import React, { useState, useEffect } from 'react';
import type { Client, DistanceSettings, QuoteSettings, LeadField } from '../types';
import * as ApiService from '@api';
import { Webhook, FileCode, Globe, FileText, MapPin, Tag } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isBaseService } from '@/utils/services';
import QuoteSettingsEditor from './QuoteSettingsEditor';
import ServicesEditor, { type ServiceState } from './ServicesEditor';

interface ClientFormProps {
    client?: Client | null;
    onSuccess: () => void;
}

const ClientForm: React.FC<ClientFormProps> = ({ client, onSuccess }) => {
    const { t } = useTranslation();
    const [name, setName] = useState('');
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    
    const [services, setServices] = useState<ServiceState[]>([]);
    
    const [leadIntakeMode, setLeadIntakeMode] = useState<'form' | 'api'>('form');
    const [mwsFixedFee, setMwsFixedFee] = useState<string>('');
    const [mwsProfitPercentage, setMwsProfitPercentage] = useState<string>('');
    const [quoteWebhookUrl, setQuoteWebhookUrl] = useState('');
    const [canDeleteLeads, setCanDeleteLeads] = useState(false);
    const [canEditLeads, setCanEditLeads] = useState(false);
    const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
    const [distanceSettings, setDistanceSettings] = useState<DistanceSettings>({
        enabled: false,
        company_address: '',
        location_field: '',
    });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = !!client;

    useEffect(() => {
        // Initial defaults that apply to ALL services (and auto-populate on new client creation)
        const initialDefaultFields: LeadField[] = [
            { id: `field_${Date.now()}_1`, name: 'nome', label: 'Nome e Cognome', type: 'text', required: true },
            { id: `field_${Date.now()}_2`, name: 'email', label: 'E-mail', type: 'email', required: false },
            { id: `field_${Date.now()}_3`, name: 'telefono', label: 'Telefono', type: 'tel', required: true },
            { id: `field_${Date.now()}_4`, name: 'note', label: 'Messaggio / Note', type: 'textarea', required: false }
        ];

        if (isEditing) {
            setName(client.name);
            setUsername('');
            setPassword('');

            const rawServices = client.services || [];

            // Lead intake mode (default/fallback mode)
            const leadModeEntry = rawServices.find((s: any) => s.name === '__lead_mode__');
            const fallbackIntakeMode: 'form' | 'api' = leadModeEntry?.mode || client.lead_intake_mode || 'form';
            setLeadIntakeMode(fallbackIntakeMode);

            // Base service (i suoi campi sono ereditati automaticamente da tutti gli altri servizi)
            const baseService = rawServices.find(isBaseService);
            const baseServiceState: ServiceState = baseService ? {
                ...baseService,
                id: baseService.id || 'service_default_fields',
                name: baseService.name === '__default_fields__' ? 'Generale' : baseService.name,
                is_base: true,
                isExpanded: false,
                intake_mode: baseService.intake_mode || fallbackIntakeMode,
                fields: (baseService.fields || []).map(f => ({ ...f, type: f.type || 'text' }))
            } : {
                id: 'service_default_fields',
                name: 'Generale',
                is_base: true,
                isExpanded: false,
                intake_mode: fallbackIntakeMode,
                fields: initialDefaultFields
            };

            // Other actual user-facing services
            const otherServices = rawServices.filter(s => s.name !== '__lead_mode__' && !isBaseService(s));
            setServices([
                baseServiceState,
                ...otherServices.map(s => ({
                    ...s,
                    isExpanded: false,
                    intake_mode: s.intake_mode || fallbackIntakeMode,
                    fields: (s.fields || []).map(f => ({ ...f, type: f.type || 'text' }))
                }))
            ]);

            setMwsFixedFee(String(client.mws_fixed_fee || ''));
            setMwsProfitPercentage(String(client.mws_profit_percentage || ''));
            setQuoteWebhookUrl(client.quote_webhook_url || '');
            setCanDeleteLeads(client.can_delete_leads ?? false);
            setCanEditLeads(client.can_edit_leads ?? false);
            setInstallmentsEnabled(client.installments_enabled ?? false);
            setDistanceSettings(client.distance_settings ?? { enabled: false, company_address: '', location_field: '' });
        } else {
            setName('');
            setUsername('');
            setEmail('');
            setPassword('');
            setServices([{
                id: 'service_default_fields',
                name: 'Generale',
                is_base: true,
                isExpanded: true,
                intake_mode: 'form',
                fields: initialDefaultFields
            }]);
            setLeadIntakeMode('form');
            setMwsFixedFee('');
            setMwsProfitPercentage('');
            setQuoteWebhookUrl('');
        }
    }, [client, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Process all services (incl. the base service, which carries is_base: true)
        const finalServices = services
            .map(s => {
                if (!s || typeof s.name !== 'string' || s.name.trim() === '') {
                    return null;
                }

                const { isExpanded, ...serviceForApi } = s;
                
                const validFields = (s.fields || []).filter(f => 
                    f && 
                    typeof f.label === 'string' && f.label.trim() !== '' &&
                    typeof f.name === 'string' && f.name.trim() !== ''
                ).map(f => {
                    if (f.options) {
                        return { ...f, options: f.options.map(opt => opt.trim()).filter(Boolean) };
                    }
                    return f;
                });

                return {
                    ...serviceForApi,
                    intake_mode: serviceForApi.intake_mode || leadIntakeMode || 'form',
                    fields: validFields,
                };
            })
            .filter(Boolean);

        // Lead mode entry (stored as special service in JSONB) — fallback/default mode
        const leadModeObj = { id: 'service_lead_mode', name: '__lead_mode__', mode: leadIntakeMode, fields: [] };

        // Combine: lead mode + all user-defined services (incl. the base service, each with its own intake_mode)
        const mergedServices = [leadModeObj, ...finalServices];

        setIsLoading(true);
        
        try {
            if (isEditing) {
                const updates: Partial<Client> = {
                    name,
                    services: mergedServices as Service[],
                    mws_fixed_fee: mwsFixedFee ? parseFloat(mwsFixedFee) : 0,
                    mws_profit_percentage: mwsProfitPercentage ? parseFloat(mwsProfitPercentage) : 0,
                    quote_webhook_url: quoteWebhookUrl,
                    can_delete_leads: canDeleteLeads,
                    can_edit_leads: canEditLeads,
                    installments_enabled: installmentsEnabled,
                    distance_settings: distanceSettings,
                };
                await ApiService.updateClient(client.id, updates);
            } else {
                await ApiService.createClient({
                    name,
                    username: username || email,
                    email,
                    password,
                    services: mergedServices as Omit<Service, 'id'>[],
                    quote_webhook_url: quoteWebhookUrl,
                });
            }
            onSuccess();
        } catch (err: any) {
            setError(err.message || 'Si è verificato un errore.');
        } finally {
            setIsLoading(false);
        }
    };
    
    const inputClasses = "mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white";

    return (
        <>
            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label htmlFor="clientName" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Nome Cliente</label>
                    <input type="text" id="clientName" value={name} onChange={(e) => setName(e.target.value)} required className={inputClasses}/>
                </div>
                {!isEditing && (
                    <>
                        <div>
                            <label htmlFor="clientEmail" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Email Cliente (per accesso)</label>
                            <input type="email" id="clientEmail" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClasses} placeholder="email@cliente.it" />
                        </div>
                        <div>
                            <label htmlFor="username" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Username (nome visualizzato)</label>
                            <input type="text" id="username" value={username} onChange={(e) => setUsername(e.target.value)} className={inputClasses} placeholder="Lascia vuoto per usare l'email" />
                        </div>
                        <div>
                            <label htmlFor="password" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Password Cliente</label>
                            <input type="password" id="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClasses} placeholder="Min. 6 caratteri" />
                        </div>
                    </>
                )}

                <fieldset className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <legend className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Impostazioni Fatturato MWS</legend>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                            <label htmlFor="mwsFixedFee" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Compenso Fisso (€)</label>
                            <div className="absolute inset-y-0 left-0 pl-3 pt-6 flex items-center pointer-events-none">
                                <span className="text-gray-400">€</span>
                            </div>
                            <input 
                                type="number" 
                                id="mwsFixedFee" 
                                value={mwsFixedFee} 
                                onChange={(e) => setMwsFixedFee(e.target.value)}
                                placeholder="0"
                                step="0.01"
                                className={`${inputClasses} pl-8`}
                            />
                        </div>
                        <div className="relative">
                            <label htmlFor="mwsProfitPercentage" className="block text-sm font-medium text-slate-700 dark:text-gray-300">% su Profitto</label>
                            <div className="absolute inset-y-0 left-0 pl-3 pt-6 flex items-center pointer-events-none">
                                <span className="text-gray-400">%</span>
                            </div>
                            <input 
                                type="number"
                                id="mwsProfitPercentage"
                                value={mwsProfitPercentage}
                                onChange={(e) => setMwsProfitPercentage(e.target.value)}
                                placeholder="0"
                                step="0.1"
                                className={`${inputClasses} pl-8`}
                            />
                        </div>
                    </div>
                </fieldset>

                <fieldset className="border-t border-slate-200 dark:border-slate-700 pt-4">
                    <legend className="text-sm font-medium text-slate-700 dark:text-gray-300 mb-2">Impostazioni Integrazioni</legend>

                    {/* Permesso eliminazione lead */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-gray-200">Permetti al cliente di eliminare le lead</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Se disabilitato, il pulsante di eliminazione non compare nella dashboard del cliente.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCanDeleteLeads(v => !v)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${canDeleteLeads ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${canDeleteLeads ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Permesso modifica lead */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-gray-200">Permetti al cliente di modificare le lead</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Se abilitato, il cliente può modificare tutti i dati delle lead. Le lead aggiunte manualmente sono sempre modificabili.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setCanEditLeads(v => !v)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${canEditLeads ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${canEditLeads ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Google Calendar */}
                    {client && (
                        <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 mb-4">
                            <div>
                                <p className="text-sm font-medium text-slate-700 dark:text-gray-200">Google Calendar</p>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                    {client.google_calendar_enabled
                                        ? '✅ Collegato — gli appuntamenti si sincronizzano automaticamente'
                                        : 'Collega l\'account Google per sincronizzare gli appuntamenti'}
                                </p>
                            </div>
                            <a
                                href={`/api/google-calendar?client_id=${client.id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-gray-200 hover:border-primary-400 transition"
                            >
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                                </svg>
                                {client.google_calendar_enabled ? 'Ricollega' : 'Collega'}
                            </a>
                        </div>
                    )}

                    {/* Pagamento a rate */}
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50 mb-4">
                        <div>
                            <p className="text-sm font-medium text-slate-700 dark:text-gray-200">Abilita pagamento a rate</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Il cliente potrà gestire piani di pagamento a rate sulle lead vinte.</p>
                        </div>
                        <button
                            type="button"
                            onClick={() => setInstallmentsEnabled(v => !v)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${installmentsEnabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                        >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${installmentsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
                        </button>
                    </div>

                    {/* Calcolo distanza automatico */}
                    <div className="mt-4 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50">
                            <div className="flex items-center gap-2">
                                <MapPin size={15} className="text-primary-500" />
                                <div>
                                    <p className="text-sm font-medium text-slate-700 dark:text-gray-200">Calcolo distanza automatico</p>
                                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Calcola i km tra la sede del cliente e il punto di intervento della lead.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDistanceSettings(s => ({ ...s, enabled: !s.enabled }))}
                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${distanceSettings.enabled ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${distanceSettings.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                            </button>
                        </div>

                        {distanceSettings.enabled && (
                            <div className="p-3 space-y-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Indirizzo sede azienda</label>
                                    <input
                                        type="text"
                                        value={distanceSettings.company_address}
                                        onChange={e => setDistanceSettings(s => ({ ...s, company_address: e.target.value }))}
                                        placeholder="Es. Via Roma 1, Milano, Italia"
                                        className={inputClasses}
                                    />
                                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">L'indirizzo di partenza da cui calcolare la distanza.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Campo lead contenente l'indirizzo di lavoro</label>
                                    <select
                                        value={distanceSettings.location_field}
                                        onChange={e => setDistanceSettings(s => ({ ...s, location_field: e.target.value }))}
                                        className={inputClasses}
                                    >
                                        <option value="">— Seleziona un campo —</option>
                                        {Array.from(
                                            new Map(
                                                services
                                                    .flatMap(s => s.fields || [])
                                                    .filter(f => f.name && f.label)
                                                    .map(f => [f.name, f])
                                            ).values()
                                        ).map(f => (
                                            <option key={f.name} value={f.name}>{f.label} ({f.name})</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Il campo del formulario/API che contiene l'indirizzo del punto di intervento.</p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4">
                        <label htmlFor="quoteWebhookUrl" className="block text-sm font-medium text-slate-700 dark:text-gray-300 flex items-center">
                            <Webhook size={14} className="mr-2"/>
                            Webhook Preventivi Accettati
                        </label>
                        <input 
                            type="url" 
                            id="quoteWebhookUrl" 
                            value={quoteWebhookUrl} 
                            onChange={(e) => setQuoteWebhookUrl(e.target.value)}
                            placeholder="https://..."
                            className={inputClasses}
                        />
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Quando un preventivo viene accettato, i dati verranno inviati a questo URL.</p>
                    </div>
                </fieldset>

                {/* LEAD INTAKE MODE SELECTOR */}
                <fieldset className="border-t border-slate-200 dark:border-slate-700 pt-5">
                    <div className="flex items-center space-x-2 mb-3">
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Modalità Ricezione Lead di Default</h3>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">
                        Modalità preimpostata per i nuovi servizi e per le lead senza un servizio specifico. Ogni servizio (sezione 2) può comunque avere una propria modalità diversa.
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            leadIntakeMode === 'form'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}>
                            <input type="radio" name="leadIntakeMode" value="form" checked={leadIntakeMode === 'form'} onChange={() => setLeadIntakeMode('form')} className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <Globe size={16} className="text-primary-500" />
                                    <span className="text-sm font-semibold text-slate-800 dark:text-white">Formulario HTML</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Le lead arrivano dal form generato dall'app. Puoi configurare servizi con campi personalizzati.</p>
                            </div>
                        </label>
                        <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${
                            leadIntakeMode === 'api'
                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                        }`}>
                            <input type="radio" name="leadIntakeMode" value="api" checked={leadIntakeMode === 'api'} onChange={() => setLeadIntakeMode('api')} className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                            <div>
                                <div className="flex items-center gap-2">
                                    <FileCode size={16} className="text-primary-500" />
                                    <span className="text-sm font-semibold text-slate-800 dark:text-white">API / Integrazione Esterna</span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Le lead arrivano via API POST. Vengono usati solo i campi di default come struttura dati.</p>
                            </div>
                        </label>
                    </div>
                </fieldset>

                {/* Servizi del cliente (incl. il servizio base, le cui campi sono ereditati da tutti gli altri) */}
                <fieldset className="border-t border-slate-200 dark:border-slate-700 pt-5">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2 text-primary-600 dark:text-primary-400">
                            <Tag size={18} />
                            <h3 className="text-base font-bold tracking-tight">Servizi e Campi Personalizzati</h3>
                        </div>
                    </div>

                    <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 bg-emerald-50 dark:bg-slate-800/50 p-3 rounded-lg border border-emerald-100 dark:border-emerald-950/40">
                        Aggiungi i vari servizi offerti dal cliente (es. <em>Irrorazione, Semina, Abbonamento Yoga</em>).
                        Per ognuno scegli un nome, la modalità di ricezione lead (form o API) e i campi richiesti.
                        Il primo servizio è quello <strong>base</strong>: i suoi campi vengono inclusi automaticamente in tutti gli altri.
                    </p>

                    <ServicesEditor services={services} onChange={setServices} defaultIntakeMode={leadIntakeMode} />
                </fieldset>

                {isEditing && client && (
                    <fieldset className="border-t border-slate-200 dark:border-slate-700 pt-5">
                        <div className="flex items-center space-x-2 mb-3 text-primary-600 dark:text-primary-400">
                            <FileText size={18} />
                            <h3 className="text-base font-bold tracking-tight">Impostazioni Preventivi</h3>
                        </div>
                        <QuoteSettingsEditor
                            client={client}
                            onSave={async (settings: QuoteSettings) => {
                                await ApiService.updateClient(client.id, { quote_settings: settings });
                            }}
                        />
                    </fieldset>
                )}

                {error && <p className="text-sm text-red-500 dark:text-red-400 mt-4 font-semibold">{error}</p>}

                <div className="flex justify-end pt-5 border-t border-slate-200 dark:border-slate-700">
                    <button type="submit" disabled={isLoading} className="bg-primary-600 text-white font-bold px-6 py-2.5 rounded-lg shadow-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                        {isLoading ? 'Salvataggio...' : (isEditing ? 'Salva Modifiche Cliente' : 'Crea Cliente')}
                    </button>
                </div>
            </form>
        </>
    );
};

export default ClientForm;
