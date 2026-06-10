import React, { useRef, useState } from 'react';
import type { Client, QuoteSettings, QuotePricePreset, QuoteBranding, QuoteTermsPreset } from '../../types';
import { PlusCircle, Trash2, Edit2, Save, X, Upload, Image as ImageIcon } from 'lucide-react';
import { uploadClientLogo } from '@api/storage';
import QuotePreviewDocument from '@components/quote/QuotePreviewDocument';

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

const emptyTermsPreset = (services: { name: string }[]): QuoteTermsPreset => ({
    id: `terms_${Date.now()}_${Math.random()}`,
    service: services[0]?.name || '*',
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

const QuoteSettingsEditor: React.FC<Props> = ({ client, onSave }) => {
    const [numbering, setNumbering] = useState(client.quote_settings?.numbering || { enabled: false, next_number: '' });
    const [presets, setPresets] = useState<QuotePricePreset[]>(client.quote_settings?.price_presets || []);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<QuotePricePreset | null>(null);

    const [branding, setBranding] = useState<QuoteBranding>(client.quote_settings?.branding || { primary_color: '#2563eb', font: 'sans' });
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoError, setLogoError] = useState('');
    const logoInputRef = useRef<HTMLInputElement>(null);

    const [termsPresets, setTermsPresets] = useState<QuoteTermsPreset[]>(client.quote_settings?.terms_presets || []);
    const [editingTermsId, setEditingTermsId] = useState<string | null>(null);
    const [editTermsBuffer, setEditTermsBuffer] = useState<QuoteTermsPreset | null>(null);

    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState('');

    const services = (client.services || []).filter(s => s.name !== '__default_fields__');

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

    const startNewTerms = () => {
        const preset = emptyTermsPreset(services);
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
            await onSave({ numbering, price_presets: presets, branding, terms_presets: termsPresets });
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
                        <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900/50" style={{ height: '320px' }}>
                            <div style={{ width: '794px', transform: 'scale(0.37)', transformOrigin: 'top left' }}>
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

                    {presets.map(preset => (
                        <div key={preset.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                            {editingId === preset.id && editBuffer ? (
                                <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome preset</label>
                                            <input
                                                type="text"
                                                value={editBuffer.label}
                                                onChange={e => setEditBuffer({ ...editBuffer, label: e.target.value })}
                                                placeholder="Es. Irrorazione campi"
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Servizio</label>
                                            <select value={editBuffer.service} onChange={e => setEditBuffer({ ...editBuffer, service: e.target.value })} className={inputCls}>
                                                <option value="*">Tutti i servizi</option>
                                                {services.map(s => (
                                                    <option key={s.id} value={s.name}>{s.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Descrizione voce preventivo (opzionale)</label>
                                        <input
                                            type="text"
                                            value={editBuffer.description}
                                            onChange={e => setEditBuffer({ ...editBuffer, description: e.target.value })}
                                            placeholder={editBuffer.label || 'Es. Trattamento agricolo con drone'}
                                            className={inputCls}
                                        />
                                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">Se lasciata vuota verrà usato il nome del preset.</p>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Unità di misura</label>
                                            <input
                                                type="text"
                                                value={editBuffer.unit}
                                                onChange={e => setEditBuffer({ ...editBuffer, unit: e.target.value })}
                                                placeholder="Es. ettaro, mq, ora"
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Prezzo unitario (€)</label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={editBuffer.price}
                                                onChange={e => setEditBuffer({ ...editBuffer, price: parseFloat(e.target.value) || 0 })}
                                                className={inputCls}
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">IVA (%)</label>
                                            <input
                                                type="number"
                                                step="1"
                                                value={editBuffer.vat}
                                                onChange={e => setEditBuffer({ ...editBuffer, vat: parseFloat(e.target.value) || 0 })}
                                                className={inputCls}
                                            />
                                        </div>
                                    </div>

                                    <div className="flex gap-2 justify-end">
                                        <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                            <X className="w-3.5 h-3.5" /> Annulla
                                        </button>
                                        <button onClick={saveEdit} disabled={!editBuffer.label.trim()}
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
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">
                                                {preset.price.toFixed(2)} € / {preset.unit || 'unità'} · IVA {preset.vat}%
                                            </span>
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-gray-500 line-clamp-2">{preset.description}</p>
                                    </div>
                                    <div className="flex gap-1 shrink-0">
                                        <button onClick={() => startEdit(preset)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-primary-500 transition-colors">
                                            <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deletePreset(preset.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-slate-400 hover:text-red-500 transition-colors">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
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
