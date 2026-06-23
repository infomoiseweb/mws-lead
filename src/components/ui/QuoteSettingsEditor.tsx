import React, { useEffect, useRef, useState } from 'react';
import type { Client, QuoteSettings, QuotePricePreset, QuoteBranding, QuoteTermsPreset } from '../../types';
import { PlusCircle, Trash2, Edit2, Save, X, Upload, Image as ImageIcon, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { uploadClientLogo } from '@api/storage';
import QuotePreviewDocument from '@components/quote/QuotePreviewDocument';
import { DEFAULT_EMAIL_SUBJECT_TEMPLATE, DEFAULT_EMAIL_BODY_TEMPLATE, DEFAULT_WHATSAPP_MESSAGE_TEMPLATE } from '@lib/quoteShareTemplates';

interface Props {
    client: Client;
    onSave: (settings: QuoteSettings) => Promise<void>;
}

const emptyPreset = (services: { name: string }[]): QuotePricePreset => ({
    id: `preset_${Date.now()}_${Math.random()}`,
    service: services[0]?.name || '*',
    label: '',
    description: '',
    unit: '',
    price: 0,
    vat: 22,
});

const emptyTermsPreset = (): QuoteTermsPreset => ({
    id: `terms_${Date.now()}_${Math.random()}`,
    service: '*',
    label: '',
    text: '',
});

const SAMPLE_PREVIEW_DATA = {
    quoteNumber: 'C5',
    quoteDate: new Date().toISOString().split('T')[0],
    dueDate: '',
    recipientName: 'Mario Rossi',
    vehicleDetails: {},
    items: [
        { description: 'Esempio voce di servizio', quantity: 1, price: 150, vat: 22 },
        { description: 'Seconda voce di esempio', quantity: 2, price: 45, vat: 22 },
    ],
    notes: 'Esempio di nota visibile nel preventivo.',
    termsAndConditions: 'Esempio di termini e condizioni: pagamento a 30 giorni dalla data di emissione.',
    taxableAmount: 240,
    vatAmount: 52.8,
    totalAmount: 292.8,
};

const FONT_OPTIONS: { value: NonNullable<QuoteBranding['font']>; label: string }[] = [
    { value: 'sans', label: 'Moderno (Sans)' },
    { value: 'serif', label: 'Classico (Serif)' },
    { value: 'mono', label: 'Tecnico (Mono)' },
];

interface PresetFormProps {
    buffer: QuotePricePreset;
    services: { id: string; name: string }[];
    inputCls: string;
    isCategory: boolean;
    hideService?: boolean;
    onChange: (p: QuotePricePreset) => void;
    onSave: () => void;
    onCancel: () => void;
}

const PresetForm: React.FC<PresetFormProps> = ({ buffer, services, inputCls, hideService, onChange, onSave, onCancel }) => {
    const isPerKm = buffer.type === 'per_km';
    return (
    <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
        {/* Toggle tipo preset */}
        <div className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600">
            <div>
                <p className="text-xs font-medium text-slate-700 dark:text-gray-200">Prezzo basato sulla distanza (€/km)</p>
                <p className="text-xs text-slate-400 dark:text-gray-500">La quantità verrà impostata automaticamente dai km calcolati da Google Maps.</p>
            </div>
            <button
                type="button"
                onClick={() => onChange({ ...buffer, type: isPerKm ? 'fixed' : 'per_km', unit: isPerKm ? '' : 'km' })}
                className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${isPerKm ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ${isPerKm ? 'translate-x-4' : 'translate-x-0'}`} />
            </button>
        </div>

        <div className={`grid grid-cols-1 gap-3 ${hideService ? '' : 'sm:grid-cols-2'}`}>
            <div>
                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome</label>
                <input type="text" value={buffer.label} onChange={e => onChange({ ...buffer, label: e.target.value })}
                    placeholder="Es. Irrorazione campi" className={inputCls} autoFocus />
            </div>
            {!hideService && (
                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Servizio</label>
                    <select value={buffer.service} onChange={e => onChange({ ...buffer, service: e.target.value })} className={inputCls}>
                        <option value="*">Tutti i servizi</option>
                        {services.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                    </select>
                </div>
            )}
        </div>
        <div>
            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Descrizione voce preventivo (opzionale)</label>
            <input type="text" value={buffer.description} onChange={e => onChange({ ...buffer, description: e.target.value })}
                placeholder={buffer.label || 'Es. Trattamento agricolo con drone'} className={inputCls} />
            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Se lasciata vuota verrà usato il nome.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Unità di misura</label>
                <input type="text" value={isPerKm ? 'km' : buffer.unit}
                    disabled={isPerKm}
                    onChange={e => onChange({ ...buffer, unit: e.target.value })}
                    placeholder="Es. ettaro, mq, ora"
                    className={`${inputCls} ${isPerKm ? 'opacity-60 cursor-not-allowed' : ''}`} />
            </div>
            <div>
                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">{isPerKm ? 'Prezzo per km (€)' : 'Prezzo unitario (€)'}</label>
                <input type="number" step="0.01" value={buffer.price}
                    onChange={e => onChange({ ...buffer, price: parseFloat(e.target.value) || 0 })}
                    onFocus={e => e.target.select()}
                    className={inputCls} />
            </div>
            <div>
                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">IVA (%)</label>
                <input type="number" step="1" value={buffer.vat}
                    onChange={e => onChange({ ...buffer, vat: parseFloat(e.target.value) || 0 })} className={inputCls} />
            </div>
        </div>
        <div className="flex gap-2 justify-end">
            <button onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                <X className="w-3.5 h-3.5" /> Annulla
            </button>
            <button onClick={onSave} disabled={!buffer.label.trim()}
                className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
                <Save className="w-3.5 h-3.5" /> Salva
            </button>
        </div>
    </div>
    );
};

const QuoteSettingsEditor: React.FC<Props> = ({ client, onSave }) => {
    const [numbering, setNumbering] = useState(client.quote_settings?.numbering || { enabled: false, next_number: '' });
    const [validityDays, setValidityDays] = useState<number>(client.quote_settings?.validity_days || 7);
    const [presets, setPresets] = useState<QuotePricePreset[]>(client.quote_settings?.price_presets || []);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editingParentId, setEditingParentId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<QuotePricePreset | null>(null);
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

    const [branding, setBranding] = useState<QuoteBranding>(client.quote_settings?.branding || { primary_color: '#2563eb', font: 'sans' });
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoError, setLogoError] = useState('');
    const logoInputRef = useRef<HTMLInputElement>(null);

    const previewContainerRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [previewHeight, setPreviewHeight] = useState(0);

    useEffect(() => {
        const updatePreviewSize = () => {
            const containerWidth = previewContainerRef.current?.offsetWidth || 0;
            const contentHeight = previewContentRef.current?.offsetHeight || 0;
            if (containerWidth > 0 && contentHeight > 0) {
                const scale = containerWidth / 794;
                setPreviewScale(scale);
                setPreviewHeight(contentHeight * scale);
            }
        };
        updatePreviewSize();
        const resizeObserver = new ResizeObserver(updatePreviewSize);
        if (previewContainerRef.current) resizeObserver.observe(previewContainerRef.current);
        if (previewContentRef.current) resizeObserver.observe(previewContentRef.current);
        return () => resizeObserver.disconnect();
    }, [branding]);

    const [termsPresets, setTermsPresets] = useState<QuoteTermsPreset[]>(client.quote_settings?.terms_presets || []);
    const [editingTermsId, setEditingTermsId] = useState<string | null>(null);
    const [editTermsBuffer, setEditTermsBuffer] = useState<QuoteTermsPreset | null>(null);

    const [defaultExtraFields, setDefaultExtraFields] = useState<string[]>(client.quote_settings?.default_extra_fields || []);

    const [includePdfLink, setIncludePdfLink] = useState<boolean>(client.quote_settings?.share_message?.include_pdf_link !== false);
    const [emailSubjectTemplate, setEmailSubjectTemplate] = useState<string>(client.quote_settings?.share_message?.email_subject_template || DEFAULT_EMAIL_SUBJECT_TEMPLATE);
    const [emailBodyTemplate, setEmailBodyTemplate] = useState<string>(client.quote_settings?.share_message?.email_body_template || DEFAULT_EMAIL_BODY_TEMPLATE);
    const [whatsappMessageTemplate, setWhatsappMessageTemplate] = useState<string>(client.quote_settings?.share_message?.whatsapp_message_template || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE);

    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const services = (client.services || []).filter(s => s.name !== '__default_fields__');

    // Tutti i campi lead disponibili (deduplicati per nome) tra tutti i servizi del cliente
    const availableLeadFields = (() => {
        const seen = new Map<string, string>();
        const excluded = ['nome', 'telefono', 'mail', 'email'];
        services.forEach(s => {
            (s.fields || []).forEach(f => {
                if (!excluded.includes(f.name) && !seen.has(f.name)) {
                    seen.set(f.name, f.label);
                }
            });
        });
        return Array.from(seen.entries()).map(([name, label]) => ({ name, label }));
    })();

    const toggleDefaultExtraField = (name: string) => {
        setDefaultExtraFields(prev => prev.includes(name) ? prev.filter(f => f !== name) : [...prev, name]);
    };

    const startEdit = (preset: QuotePricePreset) => {
        setEditingId(preset.id);
        setEditBuffer({ ...preset });
    };

    const startNew = () => {
        const preset = emptyPreset(services);
        setPresets(prev => [...prev, preset]);
        setEditingId(preset.id);
        setEditBuffer({ ...preset });
    };

    const cancelEdit = () => {
        setPresets(prev => prev.filter(p => !(p.id === editingId && !p.label)));
        setEditingId(null);
        setEditBuffer(null);
    };

    const saveEdit = () => {
        if (!editBuffer?.label.trim()) return;
        const finalized: QuotePricePreset = {
            ...editBuffer,
            description: editBuffer.description.trim() || editBuffer.label.trim(),
        };
        setPresets(prev => prev.map(p => p.id === editingId ? finalized : p));
        setEditingId(null);
        setEditBuffer(null);
    };

    const deletePreset = (id: string) => {
        setPresets(prev => prev.filter(p => p.id !== id));
    };

    const toggleExpand = (id: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const emptyChild = (parent: QuotePricePreset): QuotePricePreset => ({
        id: `preset_${Date.now()}_${Math.random()}`,
        service: parent.service,
        label: '',
        description: '',
        unit: '',
        price: 0,
        vat: 22,
    });

    const addChild = (parentId: string) => {
        const child = emptyChild(presets.find(p => p.id === parentId)!);
        setPresets(prev => prev.map(p =>
            p.id === parentId ? { ...p, children: [...(p.children || []), child] } : p
        ));
        setEditingId(child.id);
        setEditingParentId(parentId);
        setEditBuffer({ ...child });
    };

    const saveChild = () => {
        if (!editBuffer?.label.trim() || !editingParentId) return;
        const finalized: QuotePricePreset = {
            ...editBuffer,
            description: editBuffer.description.trim() || editBuffer.label.trim(),
        };
        setPresets(prev => prev.map(p =>
            p.id === editingParentId
                ? { ...p, children: (p.children || []).map(c => c.id === editingId ? finalized : c) }
                : p
        ));
        setEditingId(null);
        setEditingParentId(null);
        setEditBuffer(null);
    };

    const cancelChildEdit = () => {
        setPresets(prev => prev.map(p =>
            p.id === editingParentId
                ? { ...p, children: (p.children || []).filter(c => !(c.id === editingId && !c.label)) }
                : p
        ));
        setEditingId(null);
        setEditingParentId(null);
        setEditBuffer(null);
    };

    const startEditChild = (parentId: string, child: QuotePricePreset) => {
        setEditingParentId(parentId);
        setEditingId(child.id);
        setEditBuffer({ ...child });
    };

    const deleteChild = (parentId: string, childId: string) => {
        setPresets(prev => prev.map(p =>
            p.id === parentId ? { ...p, children: (p.children || []).filter(c => c.id !== childId) } : p
        ));
    };

    const startNewTerms = () => {
        const preset = emptyTermsPreset();
        setTermsPresets(prev => [...prev, preset]);
        setEditingTermsId(preset.id);
        setEditTermsBuffer({ ...preset });
    };

    const startEditTerms = (preset: QuoteTermsPreset) => {
        setEditingTermsId(preset.id);
        setEditTermsBuffer({ ...preset });
    };

    const cancelEditTerms = () => {
        setTermsPresets(prev => prev.filter(p => !(p.id === editingTermsId && !p.label)));
        setEditingTermsId(null);
        setEditTermsBuffer(null);
    };

    const saveEditTerms = () => {
        if (!editTermsBuffer?.label.trim()) return;
        setTermsPresets(prev => prev.map(p => p.id === editingTermsId ? editTermsBuffer : p));
        setEditingTermsId(null);
        setEditTermsBuffer(null);
    };

    const deleteTermsPreset = (id: string) => {
        setTermsPresets(prev => prev.filter(p => p.id !== id));
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setLogoError('');
        setIsUploadingLogo(true);
        try {
            const url = await uploadClientLogo(client.id, file);
            setBranding(prev => ({ ...prev, logo_url: url }));
        } catch (err: any) {
            setLogoError(err.message || 'Errore durante il caricamento del logo.');
        } finally {
            setIsUploadingLogo(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        setError('');
        try {
            await onSave({ numbering, price_presets: presets, branding, terms_presets: termsPresets, default_extra_fields: defaultExtraFields, validity_days: validityDays, share_message: { include_pdf_link: includePdfLink, email_subject_template: emailSubjectTemplate, email_body_template: emailBodyTemplate, whatsapp_message_template: whatsappMessageTemplate } });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err: any) {
            setError(err.message || 'Errore durante il salvataggio.');
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";
    const isEditingAnything = !!editingId || !!editingTermsId;
    const isChildEdit = !!editingParentId;

    return (
        <div className="space-y-6">
            {/* Numerazione preventivi */}
            <div className="space-y-3">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Numerazione preventivi</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Imposta un numero di partenza (es. "C5") e attiva l'incremento automatico per far avanzare il numero ad ogni nuovo preventivo.
                    </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={numbering.enabled}
                            onChange={e => setNumbering({ ...numbering, enabled: e.target.checked })}
                            className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                        />
                        <span className="text-sm text-slate-700 dark:text-gray-200">Numerazione automatica attiva</span>
                    </label>
                    <div className="w-full sm:w-40">
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Prossimo numero</label>
                        <input
                            type="text"
                            value={numbering.next_number}
                            onChange={e => setNumbering({ ...numbering, next_number: e.target.value.toUpperCase().substring(0, 8) })}
                            placeholder="Es. C6"
                            className={inputCls}
                        />
                    </div>
                </div>
            </div>

            {/* Validità preventivo */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Validità preventivo</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Imposta per quanti giorni è valido un preventivo dalla data di emissione. La data di scadenza verrà calcolata automaticamente alla creazione di un nuovo preventivo.
                    </p>
                </div>
                <div className="w-full sm:w-40">
                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Validità (giorni)</label>
                    <input
                        type="number"
                        min={1}
                        step="1"
                        value={validityDays}
                        onChange={e => setValidityDays(Math.max(1, parseInt(e.target.value) || 1))}
                        placeholder="Es. 7"
                        className={inputCls}
                    />
                </div>
            </div>

            {/* Branding preventivo */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Aspetto del preventivo</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Carica il tuo logo e personalizza colore e font del documento preventivo che invierai ai tuoi clienti.
                    </p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div className="space-y-3">
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Logo</label>
                            <div className="mt-1 flex items-center gap-3">
                                <div className="w-20 h-20 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900/50 shrink-0">
                                    {branding.logo_url ? (
                                        <img src={branding.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                                    ) : (
                                        <ImageIcon className="w-6 h-6 text-slate-300 dark:text-gray-600" />
                                    )}
                                </div>
                                <div className="space-y-1.5">
                                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="logo-upload-input" />
                                    <label htmlFor="logo-upload-input" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
                                        <Upload className="w-3.5 h-3.5" /> {isUploadingLogo ? 'Caricamento...' : 'Carica logo'}
                                    </label>
                                    {branding.logo_url && (
                                        <button onClick={() => setBranding(prev => ({ ...prev, logo_url: undefined }))} className="block text-xs text-red-500 hover:text-red-600">
                                            Rimuovi logo
                                        </button>
                                    )}
                                    {logoError && <p className="text-xs text-red-500">{logoError}</p>}
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome del brand</label>
                            <input
                                type="text"
                                value={branding.brand_name || ''}
                                onChange={e => setBranding(prev => ({ ...prev, brand_name: e.target.value }))}
                                placeholder={client.name}
                                className={inputCls}
                            />
                            <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                                Mostrato al posto del logo nell'intestazione del preventivo, se non carichi un logo. Se vuoto verrà usato "{client.name}".
                            </p>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Colore principale</label>
                                <div className="mt-1 flex items-center gap-2">
                                    <input
                                        type="color"
                                        value={branding.primary_color || '#2563eb'}
                                        onChange={e => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                                        className="h-9 w-12 rounded-md border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent"
                                    />
                                    <span className="text-xs text-slate-500 dark:text-gray-400">{branding.primary_color || '#2563eb'}</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Font</label>
                                <select
                                    value={branding.font || 'sans'}
                                    onChange={e => setBranding(prev => ({ ...prev, font: e.target.value as QuoteBranding['font'] }))}
                                    className={inputCls}
                                >
                                    {FONT_OPTIONS.map(opt => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Dati azienda (indirizzo, P.IVA, contatti)</label>
                            <textarea
                                value={branding.company_details || ''}
                                onChange={e => setBranding(prev => ({ ...prev, company_details: e.target.value }))}
                                rows={3}
                                placeholder={"Es. Via Roma 1, 00100 Roma\nP.IVA 12345678901\ntel. 333 1234567"}
                                className={inputCls}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Anteprima</label>
                        <div ref={previewContainerRef} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900/50" style={{ height: previewHeight || undefined }}>
                            <div ref={previewContentRef} style={{ width: '794px', transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                                <QuotePreviewDocument clientName={client.name} branding={branding} data={SAMPLE_PREVIEW_DATA} />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Preset di prezzo */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Preset di prezzo</h3>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            Crea voci di preventivo predefinite per servizio (es. prezzo a ettaro, mq, ora) da inserire con un click.
                        </p>
                    </div>
                    <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors">
                        <PlusCircle className="w-3.5 h-3.5" /> Nuovo preset
                    </button>
                </div>

                <div className="space-y-3">
                    {presets.length === 0 && (
                        <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                            Nessun preset. Clicca "Nuovo preset" per iniziare.
                        </p>
                    )}

                    {presets.map(preset => {
                        const isCategory = (preset.children?.length ?? 0) > 0;
                        const isExpanded = expandedCategories.has(preset.id);
                        const isEditingThis = editingId === preset.id && !isChildEdit;

                        return (
                            <div key={preset.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                                {/* Riga categoria / preset semplice */}
                                {isEditingThis && editBuffer ? (
                                    <PresetForm
                                        buffer={editBuffer}
                                        services={services}
                                        inputCls={inputCls}
                                        isCategory={false}
                                        onChange={setEditBuffer}
                                        onSave={saveEdit}
                                        onCancel={cancelEdit}
                                    />
                                ) : (
                                    <div className="flex items-start gap-2 p-3 bg-white dark:bg-slate-800">
                                        {/* Toggle espandi se ha figli */}
                                        {isCategory ? (
                                            <button onClick={() => toggleExpand(preset.id)} className="mt-0.5 p-0.5 text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 transition-colors">
                                                {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                            </button>
                                        ) : (
                                            <span className="w-5" />
                                        )}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                                                <span className="text-sm font-semibold text-slate-800 dark:text-white">{preset.label}</span>
                                                {preset.service !== '*' && (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">{preset.service}</span>
                                                )}
                                                {isCategory ? (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300">{preset.children!.length} voci</span>
                                                ) : (
                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">
                                                        {preset.price.toFixed(2)} € / {preset.unit || 'unità'} · IVA {preset.vat}%
                                                    </span>
                                                )}
                                            </div>
                                            {!isCategory && <p className="text-xs text-slate-400 dark:text-gray-500 line-clamp-1">{preset.description}</p>}
                                        </div>
                                        <div className="flex gap-1 shrink-0">
                                            <button onClick={() => addChild(preset.id)} title="Aggiungi sotto-voce" className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-emerald-500 transition-colors">
                                                <Plus className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => startEdit(preset)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-primary-500 transition-colors">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => deletePreset(preset.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-slate-400 hover:text-red-500 transition-colors">
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* Sotto-voci */}
                                {isCategory && isExpanded && (
                                    <div className="border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/30">
                                        {(preset.children || []).map(child => {
                                            const isEditingChild = editingId === child.id && editingParentId === preset.id;
                                            return (
                                                <div key={child.id} className="border-b border-slate-100 dark:border-slate-700 last:border-b-0">
                                                    {isEditingChild && editBuffer ? (
                                                        <div className="ml-6">
                                                            <PresetForm
                                                                buffer={editBuffer}
                                                                services={services}
                                                                inputCls={inputCls}
                                                                isCategory={false}
                                                                hideService
                                                                onChange={setEditBuffer}
                                                                onSave={saveChild}
                                                                onCancel={cancelChildEdit}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-center gap-2 pl-9 pr-3 py-2.5">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap">
                                                                    <span className="text-sm text-slate-700 dark:text-gray-200">{child.label}</span>
                                                                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">
                                                                        {child.price.toFixed(2)} € / {child.unit || 'unità'} · IVA {child.vat}%
                                                                    </span>
                                                                </div>
                                                                {child.description && child.description !== child.label && (
                                                                    <p className="text-xs text-slate-400 dark:text-gray-500 line-clamp-1 mt-0.5">{child.description}</p>
                                                                )}
                                                            </div>
                                                            <div className="flex gap-1 shrink-0">
                                                                <button onClick={() => startEditChild(preset.id, child)} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-primary-500 transition-colors">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => deleteChild(preset.id, child.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-slate-400 hover:text-red-500 transition-colors">
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Termini e Condizioni preimpostati */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Termini e Condizioni</h3>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            Crea testi predefiniti di termini e condizioni per servizio: verranno proposti automaticamente nel nuovo preventivo e potrai modificarli prima di salvare.
                        </p>
                    </div>
                    <button onClick={startNewTerms} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors">
                        <PlusCircle className="w-3.5 h-3.5" /> Nuovo preset
                    </button>
                </div>

                <div className="space-y-3">
                    {termsPresets.length === 0 && (
                        <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                            Nessun preset. Clicca "Nuovo preset" per iniziare.
                        </p>
                    )}

                    {termsPresets.map(preset => (
                        <div key={preset.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            {editingTermsId === preset.id && editTermsBuffer ? (
                                <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome preset</label>
                                            <input
                                                type="text"
                                                value={editTermsBuffer.label}
                                                onChange={e => setEditTermsBuffer({ ...editTermsBuffer, label: e.target.value })}
                                                placeholder="Es. Termini standard"
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Servizio</label>
                                            <select value={editTermsBuffer.service} onChange={e => setEditTermsBuffer({ ...editTermsBuffer, service: e.target.value })} className={inputCls}>
                                                <option value="*">Tutti i servizi</option>
                                                {services.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Testo termini e condizioni</label>
                                        <textarea
                                            value={editTermsBuffer.text}
                                            onChange={e => setEditTermsBuffer({ ...editTermsBuffer, text: e.target.value })}
                                            rows={4}
                                            placeholder="Es. Pagamento a 30 giorni dalla data di emissione del preventivo..."
                                            className={inputCls}
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button onClick={cancelEditTerms} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                            <X className="w-3.5 h-3.5" /> Annulla
                                        </button>
                                        <button onClick={saveEditTerms} disabled={!editTermsBuffer.label.trim()}
                                            className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
                                            <Save className="w-3.5 h-3.5" /> Salva preset
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{preset.label}</span>
                                            {preset.service !== '*' && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                                    {preset.service}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-gray-500 line-clamp-2 whitespace-pre-line">{preset.text}</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => startEditTerms(preset)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-primary-500 transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteTermsPreset(preset.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Campi aggiuntivi nel preventivo */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Campi aggiuntivi nel preventivo</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Scegli quali dati arrivati con la lead vuoi mostrare automaticamente nel preventivo, accanto al "Destinatario". Potrai comunque modificare la selezione in ogni singolo preventivo.
                    </p>
                </div>

                {availableLeadFields.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-4 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Nessun campo aggiuntivo disponibile.
                    </p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {availableLeadFields.map(field => (
                            <label key={field.name} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-gray-300 cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={defaultExtraFields.includes(field.name)}
                                    onChange={() => toggleDefaultExtraField(field.name)}
                                    className="w-3.5 h-3.5 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                                />
                                {field.label}
                            </label>
                        ))}
                    </div>
                )}
            </div>

            {/* Messaggio di condivisione (WhatsApp/Email) */}
            <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Messaggio di condivisione (WhatsApp/Email)</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Quando invii un preventivo via WhatsApp o Email, scegli se includere nel messaggio la riga con il link per scaricare il PDF.
                    </p>
                </div>
                <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                        type="checkbox"
                        checked={includePdfLink}
                        onChange={e => setIncludePdfLink(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-slate-700 dark:text-gray-200">Includi nel messaggio "Puoi scaricarlo da qui: [link al PDF]"</span>
                </label>

                <p className="text-xs text-slate-400 dark:text-gray-500">
                    Placeholder disponibili: <code>{'{{nome}}'}</code> (destinatario), <code>{'{{numero}}'}</code> (numero preventivo), <code>{'{{azienda}}'}</code> (nome/brand), <code>{'{{link_pdf}}'}</code> (riga con link al PDF, vuota se disattivato sopra).
                </p>

                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Oggetto Email</label>
                        <button type="button" onClick={() => setEmailSubjectTemplate(DEFAULT_EMAIL_SUBJECT_TEMPLATE)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Ripristina predefinito</button>
                    </div>
                    <input type="text" value={emailSubjectTemplate} onChange={e => setEmailSubjectTemplate(e.target.value)} className={inputCls} />
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Messaggio Email</label>
                        <button type="button" onClick={() => setEmailBodyTemplate(DEFAULT_EMAIL_BODY_TEMPLATE)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Ripristina predefinito</button>
                    </div>
                    <textarea value={emailBodyTemplate} onChange={e => setEmailBodyTemplate(e.target.value)} rows={5} className={inputCls} />
                </div>

                <div>
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Messaggio WhatsApp</label>
                        <button type="button" onClick={() => setWhatsappMessageTemplate(DEFAULT_WHATSAPP_MESSAGE_TEMPLATE)} className="text-xs text-primary-600 dark:text-primary-400 hover:underline">Ripristina predefinito</button>
                    </div>
                    <textarea value={whatsappMessageTemplate} onChange={e => setWhatsappMessageTemplate(e.target.value)} rows={3} className={inputCls} />
                </div>
            </div>

            {error && <p className="text-sm text-red-500 dark:text-red-400">{error}</p>}
            {isEditingAnything && <p className="text-sm text-amber-600 dark:text-amber-400">Completa o annulla la modifica del preset in corso prima di salvare.</p>}

            <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                <button onClick={handleSaveAll} disabled={isSaving || isEditingAnything}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                    {isSaving ? 'Salvataggio...' : saved ? '✓ Salvato!' : 'Salva impostazioni preventivi'}
                </button>
            </div>
        </div>
    );
};

export default QuoteSettingsEditor;
