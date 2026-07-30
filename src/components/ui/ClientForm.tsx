import React, { useState, useEffect } from 'react';
import type { Client, DistanceSettings, QuoteSettings, LeadField, Service } from '../types';
import * as ApiService from '@api';
import { Webhook, FileCode, Globe, FileText, MapPin, Tag, User, Settings, Share2, CreditCard, Shield, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { isBaseService } from '@/utils/services';
import QuoteSettingsEditor from './QuoteSettingsEditor';
import ServicesEditor, { type ServiceState } from './ServicesEditor';
import OperatorsManager from './OperatorsManager';

interface ClientFormProps {
    client?: Client | null;
    onSuccess: () => void;
}

type Section = 'generale' | 'permessi' | 'integrazioni' | 'lead' | 'preventivi';

const NAV_ITEMS: { id: Section; label: string; icon: React.ReactNode; editOnly?: boolean }[] = [
    { id: 'generale',     label: 'Generale',       icon: <User size={16} /> },
    { id: 'permessi',     label: 'Permessi',        icon: <Shield size={16} />,    editOnly: true },
    { id: 'integrazioni', label: 'Integrazioni',    icon: <Settings size={16} />,  editOnly: true },
    { id: 'lead',         label: 'Lead e Servizi',  icon: <Tag size={16} /> },
    { id: 'preventivi',   label: 'Preventivi',      icon: <FileText size={16} />,  editOnly: true },
];

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
    return (
        <button
            type="button"
            onClick={onChange}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${checked ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
        >
            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${checked ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
    );
}

function ToggleRow({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: () => void }) {
    return (
        <div className="flex items-center justify-between py-3.5 border-b border-slate-100 dark:border-slate-700/60 last:border-0">
            <div className="pr-4">
                <p className="text-sm font-medium text-slate-700 dark:text-gray-200">{label}</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">{description}</p>
            </div>
            <Toggle checked={checked} onChange={onChange} />
        </div>
    );
}

const ClientForm: React.FC<ClientFormProps> = ({ client, onSuccess }) => {
    const { t } = useTranslation();
    const [activeSection, setActiveSection] = useState<Section>('generale');
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
    const [metaEnabled, setMetaEnabled] = useState(false);
    const [operatorsEnabled, setOperatorsEnabled] = useState(false);
    const [installmentsEnabled, setInstallmentsEnabled] = useState(false);
    const [distanceSettings, setDistanceSettings] = useState<DistanceSettings>({ enabled: false, company_address: '', location_field: '' });
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const isEditing = !!client;

    useEffect(() => {
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
            const leadModeEntry = rawServices.find((s: any) => s.name === '__lead_mode__');
            const fallbackIntakeMode: 'form' | 'api' = leadModeEntry?.mode || client.lead_intake_mode || 'form';
            setLeadIntakeMode(fallbackIntakeMode);
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
            setOperatorsEnabled(client.operators_enabled ?? false);
            setMetaEnabled(client.meta_enabled ?? false);
            setInstallmentsEnabled(client.installments_enabled ?? false);
            setDistanceSettings(client.distance_settings ?? { enabled: false, company_address: '', location_field: '' });
        } else {
            setName(''); setUsername(''); setEmail(''); setPassword('');
            setServices([{ id: 'service_default_fields', name: 'Generale', is_base: true, isExpanded: true, intake_mode: 'form', fields: initialDefaultFields }]);
            setLeadIntakeMode('form');
            setMwsFixedFee(''); setMwsProfitPercentage(''); setQuoteWebhookUrl('');
        }
    }, [client, isEditing]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const finalServices = services.map(s => {
            if (!s || typeof s.name !== 'string' || s.name.trim() === '') return null;
            const { isExpanded, ...serviceForApi } = s;
            const validFields = (s.fields || []).filter(f =>
                f && typeof f.label === 'string' && f.label.trim() !== '' && typeof f.name === 'string' && f.name.trim() !== ''
            ).map(f => f.options ? { ...f, options: f.options.map(opt => opt.trim()).filter(Boolean) } : f);
            return { ...serviceForApi, intake_mode: serviceForApi.intake_mode || leadIntakeMode || 'form', fields: validFields };
        }).filter(Boolean);
        const leadModeObj = { id: 'service_lead_mode', name: '__lead_mode__', mode: leadIntakeMode, fields: [] };
        const mergedServices = [leadModeObj, ...finalServices];
        setIsLoading(true);
        try {
            if (isEditing) {
                await ApiService.updateClient(client.id, {
                    name,
                    services: mergedServices as Service[],
                    mws_fixed_fee: mwsFixedFee ? parseFloat(mwsFixedFee) : 0,
                    mws_profit_percentage: mwsProfitPercentage ? parseFloat(mwsProfitPercentage) : 0,
                    quote_webhook_url: quoteWebhookUrl,
                    can_delete_leads: canDeleteLeads,
                    can_edit_leads: canEditLeads,
                    meta_enabled: metaEnabled,
                    installments_enabled: installmentsEnabled,
                    operators_enabled: operatorsEnabled,
                    distance_settings: distanceSettings,
                });
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

    const inputClasses = "mt-1 block w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-slate-900 dark:text-white text-sm";

    // ── SEZIONI ──────────────────────────────────────────────────────────────

    const sectionGenerale = (
        <div className="space-y-5">
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Nome Cliente</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} required className={inputClasses} />
            </div>
            {!isEditing && (
                <>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Email (per accesso)</label>
                        <input type="email" value={email} onChange={e => setEmail(e.target.value)} required className={inputClasses} placeholder="email@cliente.it" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Username (nome visualizzato)</label>
                        <input type="text" value={username} onChange={e => setUsername(e.target.value)} className={inputClasses} placeholder="Lascia vuoto per usare l'email" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">Password Cliente</label>
                        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className={inputClasses} placeholder="Min. 6 caratteri" />
                    </div>
                </>
            )}
            <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-3">Fatturato MWS</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="relative">
                        <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Compenso Fisso (€)</label>
                        <div className="absolute left-3 top-[1.85rem] text-slate-400 text-sm pointer-events-none">€</div>
                        <input type="number" value={mwsFixedFee} onChange={e => setMwsFixedFee(e.target.value)} placeholder="0" step="0.01" className={`${inputClasses} pl-7`} />
                    </div>
                    <div className="relative">
                        <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">% su Profitto</label>
                        <div className="absolute left-3 top-[1.85rem] text-slate-400 text-sm pointer-events-none">%</div>
                        <input type="number" value={mwsProfitPercentage} onChange={e => setMwsProfitPercentage(e.target.value)} placeholder="0" step="0.1" className={`${inputClasses} pl-7`} />
                    </div>
                </div>
            </div>
        </div>
    );

    const sectionPermessi = (
        <div>
            <p className="text-xs text-slate-500 dark:text-gray-400 mb-4">Controlla cosa può fare il cliente nella sua dashboard.</p>
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700/60 overflow-hidden">
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Lead</p>
                </div>
                <div className="px-4">
                    <ToggleRow label="Elimina lead" description="Il cliente può eliminare le proprie lead." checked={canDeleteLeads} onChange={() => setCanDeleteLeads(v => !v)} />
                    <ToggleRow label="Modifica lead" description="Il cliente può modificare tutti i dati delle lead. Le lead manuali sono sempre modificabili." checked={canEditLeads} onChange={() => setCanEditLeads(v => !v)} />
                </div>
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-gray-400">Funzionalità</p>
                </div>
                <div className="px-4">
                    <ToggleRow label="Operatori" description="Traccia quale operatore ha cambiato lo stato di ogni lead (per account con più persone)." checked={operatorsEnabled} onChange={() => setOperatorsEnabled(v => !v)} />
                    <ToggleRow label="Pagamento a rate" description="Il cliente può gestire piani di pagamento a rate sulle lead vinte." checked={installmentsEnabled} onChange={() => setInstallmentsEnabled(v => !v)} />
                    <ToggleRow label="Social Meta (Facebook / Instagram)" description={metaEnabled ? 'Sezione Social attiva — il cliente può collegare il suo account Meta.' : 'Abilita la sezione Social per questo cliente.'} checked={metaEnabled} onChange={() => setMetaEnabled(v => !v)} />
                </div>
            </div>

            {/* Lista operatori — visibile solo se la funzione è attiva e si sta modificando un cliente esistente */}
            {operatorsEnabled && isEditing && client && (
                <div className="mt-5 pt-5 border-t border-slate-200 dark:border-slate-700">
                    <OperatorsManager clientId={client.id} />
                </div>
            )}
        </div>
    );

    const sectionIntegrazioni = (
        <div className="space-y-4">
            {/* Google Calendar */}
            {client && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Google Calendar</p>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                            {client.google_calendar_enabled
                                ? '✅ Collegato — gli appuntamenti si sincronizzano automaticamente'
                                : 'Non collegato — gli appuntamenti non vengono sincronizzati'}
                        </p>
                        <a
                            href={`/api/google-calendar?client_id=${client.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-gray-200 hover:border-primary-400 transition"
                        >
                            {client.google_calendar_enabled ? 'Ricollega' : 'Collega'}
                        </a>
                    </div>
                </div>
            )}

            {/* Meta */}
            {client && metaEnabled && (
                <div className="rounded-xl border border-blue-200 dark:border-blue-800 overflow-hidden">
                    <div className="px-4 py-3 bg-blue-50 dark:bg-blue-900/20 flex items-center gap-2">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Account Meta</p>
                    </div>
                    <div className="px-4 py-3 flex items-center justify-between gap-4">
                        <p className="text-xs text-slate-500 dark:text-gray-400">
                            {client.meta_access_token
                                ? '✅ Collegato — il cliente può pubblicare su Facebook/Instagram'
                                : 'Non ancora collegato dal cliente'}
                        </p>
                        <a
                            href={`/api/meta?client_id=${client.id}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-xs font-semibold text-slate-700 dark:text-gray-200 hover:border-blue-400 transition"
                        >
                            Collega come admin
                        </a>
                    </div>
                </div>
            )}

            {/* Calcolo distanza */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/30 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MapPin size={15} className="text-primary-500" />
                        <div>
                            <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Calcolo distanza automatico</p>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">Calcola i km tra la sede e il punto di intervento della lead.</p>
                        </div>
                    </div>
                    <Toggle checked={distanceSettings.enabled} onChange={() => setDistanceSettings(s => ({ ...s, enabled: !s.enabled }))} />
                </div>
                {distanceSettings.enabled && (
                    <div className="px-4 py-4 space-y-3 border-t border-slate-200 dark:border-slate-700">
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Indirizzo sede azienda</label>
                            <input type="text" value={distanceSettings.company_address} onChange={e => setDistanceSettings(s => ({ ...s, company_address: e.target.value }))} placeholder="Es. Via Roma 1, Milano, Italia" className={inputClasses} />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-slate-600 dark:text-gray-400 mb-1">Campo lead con l'indirizzo di lavoro</label>
                            <select value={distanceSettings.location_field} onChange={e => setDistanceSettings(s => ({ ...s, location_field: e.target.value }))} className={inputClasses}>
                                <option value="">— Seleziona un campo —</option>
                                {(() => {
                                    const allFields: LeadField[] = services.flatMap(s => (s.fields || []) as LeadField[]).filter(f => f.name && f.label);
                                    const unique = Array.from(new Map(allFields.map(f => [f.name, f])).values());
                                    return unique.map(f => <option key={f.name} value={f.name}>{f.label} ({f.name})</option>);
                                })()}
                            </select>
                        </div>
                    </div>
                )}
            </div>

            {/* Webhook */}
            <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1 flex items-center gap-1.5">
                    <Webhook size={14} /> Webhook Preventivi Accettati
                </label>
                <input type="url" value={quoteWebhookUrl} onChange={e => setQuoteWebhookUrl(e.target.value)} placeholder="https://..." className={inputClasses} />
                <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Quando un preventivo viene accettato, i dati vengono inviati a questo URL.</p>
            </div>
        </div>
    );

    const sectionLead = (
        <div className="space-y-6">
            <div>
                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-1">Modalità Ricezione Lead di Default</p>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-3">Ogni servizio può comunque avere una propria modalità diversa.</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${leadIntakeMode === 'form' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                        <input type="radio" name="leadIntakeMode" value="form" checked={leadIntakeMode === 'form'} onChange={() => setLeadIntakeMode('form')} className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                        <div>
                            <div className="flex items-center gap-2"><Globe size={15} className="text-primary-500" /><span className="text-sm font-semibold text-slate-800 dark:text-white">Formulario HTML</span></div>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Le lead arrivano dal form generato dall'app.</p>
                        </div>
                    </label>
                    <label className={`flex items-start gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${leadIntakeMode === 'api' ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-700 hover:border-slate-300'}`}>
                        <input type="radio" name="leadIntakeMode" value="api" checked={leadIntakeMode === 'api'} onChange={() => setLeadIntakeMode('api')} className="mt-0.5 h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500" />
                        <div>
                            <div className="flex items-center gap-2"><FileCode size={15} className="text-primary-500" /><span className="text-sm font-semibold text-slate-800 dark:text-white">API / Integrazione Esterna</span></div>
                            <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">Le lead arrivano via API POST.</p>
                        </div>
                    </label>
                </div>
            </div>

            <div>
                <div className="flex items-center gap-2 mb-2">
                    <Tag size={16} className="text-primary-500" />
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Servizi e Campi Personalizzati</p>
                </div>
                <p className="text-xs text-slate-500 dark:text-gray-400 mb-4 bg-emerald-50 dark:bg-slate-800/50 p-3 rounded-lg border border-emerald-100 dark:border-emerald-950/40">
                    Aggiungi i servizi offerti dal cliente (es. <em>Irrorazione, Semina</em>). Il primo servizio è quello <strong>base</strong>: i suoi campi vengono inclusi in tutti gli altri.
                </p>
                <ServicesEditor services={services} onChange={setServices} defaultIntakeMode={leadIntakeMode} />
            </div>
        </div>
    );

    const sectionPreventivi = (
        <div>
            {client && (
                <QuoteSettingsEditor
                    client={client}
                    onSave={async (settings: QuoteSettings) => {
                        await ApiService.updateClient(client.id, { quote_settings: settings });
                    }}
                />
            )}
        </div>
    );

    const sectionContent: Record<Section, React.ReactNode> = {
        generale: sectionGenerale,
        permessi: sectionPermessi,
        integrazioni: sectionIntegrazioni,
        lead: sectionLead,
        preventivi: sectionPreventivi,
    };

    const sectionLabel: Record<Section, string> = {
        generale: 'Generale',
        permessi: 'Permessi',
        integrazioni: 'Integrazioni',
        lead: 'Lead e Servizi',
        preventivi: 'Preventivi',
    };

    const visibleNav = NAV_ITEMS.filter(item => !item.editOnly || isEditing);

    // ── LAYOUT CREAZIONE (semplice, senza sidebar) ─────────────────────────
    if (!isEditing) {
        return (
            <form onSubmit={handleSubmit} className="space-y-5">
                {sectionGenerale}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-semibold text-slate-700 dark:text-gray-200 mb-3 flex items-center gap-2"><Tag size={15} className="text-primary-500" />Servizi e Campi</p>
                    <ServicesEditor services={services} onChange={setServices} defaultIntakeMode={leadIntakeMode} />
                </div>
                {error && <p className="text-sm text-red-500 font-semibold">{error}</p>}
                <div className="flex justify-end pt-2">
                    <button type="submit" disabled={isLoading} className="bg-primary-600 text-white font-bold px-6 py-2.5 rounded-lg shadow hover:bg-primary-700 transition disabled:opacity-50">
                        {isLoading ? 'Creazione...' : 'Crea Cliente'}
                    </button>
                </div>
            </form>
        );
    }

    // ── LAYOUT MODIFICA (sidebar sinistra + contenuto destra) ──────────────
    return (
        <form onSubmit={handleSubmit} className="flex gap-0 min-h-[520px]">
            {/* Sidebar navigazione */}
            <nav className="w-48 flex-shrink-0 border-r border-slate-200 dark:border-slate-700 pr-0 pt-1">
                <ul className="space-y-0.5">
                    {visibleNav.map(item => (
                        <li key={item.id}>
                            <button
                                type="button"
                                onClick={() => setActiveSection(item.id)}
                                className={`w-full flex items-center justify-between gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                                    activeSection === item.id
                                        ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                        : 'text-slate-600 dark:text-gray-400 hover:bg-slate-100 dark:hover:bg-slate-700/40 hover:text-slate-800 dark:hover:text-white'
                                }`}
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className={activeSection === item.id ? 'text-primary-500' : 'text-slate-400 dark:text-slate-500'}>{item.icon}</span>
                                    {item.label}
                                </span>
                                {activeSection === item.id && <ChevronRight size={14} className="text-primary-400 flex-shrink-0" />}
                            </button>
                        </li>
                    ))}
                </ul>
            </nav>

            {/* Contenuto sezione */}
            <div className="flex-1 pl-6 flex flex-col min-w-0">
                <div className="mb-4">
                    <h3 className="text-base font-bold text-slate-800 dark:text-white">{sectionLabel[activeSection]}</h3>
                    <div className="h-0.5 w-8 bg-primary-500 mt-1 rounded-full" />
                </div>

                <div className="flex-1 overflow-y-auto">
                    {sectionContent[activeSection]}
                </div>

                {error && <p className="text-sm text-red-500 font-semibold mt-3">{error}</p>}

                {activeSection !== 'preventivi' && (
                    <div className="flex justify-end pt-4 mt-4 border-t border-slate-200 dark:border-slate-700">
                        <button type="submit" disabled={isLoading} className="bg-primary-600 text-white font-bold px-6 py-2.5 rounded-lg shadow hover:bg-primary-700 transition disabled:opacity-50">
                            {isLoading ? 'Salvataggio...' : 'Salva Modifiche'}
                        </button>
                    </div>
                )}
            </div>
        </form>
    );
};

export default ClientForm;
