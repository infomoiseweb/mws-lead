import React, { useState, useEffect, useMemo } from 'react';
import Modal from '@components/ui/Modal';
import * as ApiService from '@api';
import type { Client, Lead, Quote, QuoteItem, QuotePricePreset } from '../types';
import { Plus, Trash2, Save, Loader2, X, ChevronDown, User, Phone, Mail, Tag, Calendar, Eye, RotateCcw } from 'lucide-react';
import { incrementQuoteNumber } from '@lib/quoteNumbering';
import QuotePreviewDocument from './QuotePreviewDocument';

interface QuoteCreatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    client: Client;
    lead: Lead;
    quoteToEdit: Quote | null;
    onSave: (quote: Quote) => void;
}

// A new type for managing form state with strings
interface QuoteItemForState {
    id: string;
    description: string;
    quantity: string;
    price: string;
    vat: string;
}

const getServiceFromLead = (lead: Lead): string => {
    const data = lead.data || {};
    
    // User requested to prioritize 'tipo_di_tagliando_'
    if (data['tipo_di_tagliando_']) {
        return data['tipo_di_tagliando_'];
    }

    const searchKeys = [
        'tipo di tagliando', 'tipo_di_tagliando', 'tipo_tagliando',
        'servizio richiesto', 'servizio_richiesto',
        'servizio', 'service'
    ];
    for (const key of searchKeys) {
        // Find a case-insensitive match in lead.data keys, trimming spaces for robustness
        const matchingKey = Object.keys(data).find(dataKey => dataKey.toLowerCase().replace(/_/g, ' ').trim() === key);
        if (matchingKey && data[matchingKey]) {
            return data[matchingKey];
        }
    }
    return lead.service || ''; // Fallback to the lead's main service property
};

const QuoteCreatorModal: React.FC<QuoteCreatorModalProps> = ({ isOpen, onClose, client, lead, quoteToEdit, onSave }) => {
    const [quoteDate, setQuoteDate] = useState(new Date().toISOString().split('T')[0]);
    const [dueDate, setDueDate] = useState('');
    const [recipientName, setRecipientName] = useState('');
    const [vehicleDetails, setVehicleDetails] = useState<Record<string, string>>({});
    const [service, setService] = useState('');
    const [items, setItems] = useState<QuoteItemForState[]>([]);
    const [notes, setNotes] = useState('');
    const [manualQuoteNumber, setManualQuoteNumber] = useState('');
    const [termsAndConditions, setTermsAndConditions] = useState('');
    const [leftTab, setLeftTab] = useState<'lead' | 'preview'>('lead');

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const descriptionSuggestions = useMemo(() => {
        const presets = client.quote_settings?.price_presets || [];
        return Array.from(new Set(presets.map(p => p.description).filter(Boolean)));
    }, [client.quote_settings]);

    const isEditing = !!quoteToEdit;

    const getDefaultTerms = (svc: string): string => {
        const presets = client.quote_settings?.terms_presets || [];
        const matching = presets.find(p => p.service !== '*' && p.service === svc);
        const fallback = presets.find(p => p.service === '*');
        return (matching || fallback)?.text || '';
    };

    useEffect(() => {
        if (isOpen) {
            setError('');
            const isFacchetti = client.name.toLowerCase().includes('facche');

            if (isEditing && quoteToEdit) {
                // Load data for editing
                setQuoteDate(quoteToEdit.quote_date);
                setDueDate(quoteToEdit.due_date || '');
                setRecipientName(quoteToEdit.recipient_name);
                setVehicleDetails(quoteToEdit.vehicle_details || {});
                const serviceFromQuote = isFacchetti ? (quoteToEdit.vehicle_details?.['Servizio'] || '') : getServiceFromLead(lead);
                setService(serviceFromQuote);
                
                const fullQuoteNumber = quoteToEdit.quote_number_display || '';
                if (isFacchetti && serviceFromQuote && fullQuoteNumber.endsWith(serviceFromQuote)) {
                    setManualQuoteNumber(fullQuoteNumber.replace(serviceFromQuote, '').trim());
                } else {
                    setManualQuoteNumber(fullQuoteNumber);
                }


                if (Array.isArray(quoteToEdit.items)) {
                     setItems(quoteToEdit.items.map(item => ({
                        id: crypto.randomUUID(),
                        description: item.description,
                        quantity: String(item.quantity).replace('.', ','),
                        price: String(item.price).replace('.', ','),
                        vat: String(item.vat).replace('.', ','),
                    })));
                } else {
                    // Backwards compatibility for old format
                    const oldItems = quoteToEdit.items as Record<string, string>;
                     setItems(Object.entries(oldItems).map(([desc, val]) => ({
                        id: crypto.randomUUID(),
                        description: `${desc}: ${val}`,
                        quantity: '1',
                        price: '0',
                        vat: '22',
                    })));
                }
                
                setNotes(quoteToEdit.notes || '');
                setTermsAndConditions(quoteToEdit.terms_and_conditions || '');

            } else {
                // Set defaults for new quote
                setQuoteDate(new Date().toISOString().split('T')[0]);
                const nextWeek = new Date();
                nextWeek.setDate(nextWeek.getDate() + 7);
                setDueDate(nextWeek.toISOString().split('T')[0]);
                setRecipientName(lead.data.nome || '');
                // Mostra solo i campi veicolo che il lead possiede effettivamente
                // (rilevanti per clienti tipo officine, non per tutti i clienti)
                const vehicleFieldDefs: { label: string; keys: string[] }[] = [
                    { label: 'Marca', keys: ['marca'] },
                    { label: 'Modello', keys: ['modello'] },
                    { label: 'Targa', keys: ['targa'] },
                    { label: 'Telaio', keys: ['telaio'] },
                    { label: 'KM', keys: ['chilometraggio', 'km'] },
                ];
                const detectedVehicleDetails: Record<string, string> = {};
                vehicleFieldDefs.forEach(({ label, keys }) => {
                    const foundKey = keys.find(k => k in lead.data);
                    if (foundKey) detectedVehicleDetails[label] = lead.data[foundKey] || '';
                });
                setVehicleDetails(detectedVehicleDetails);
                setService(getServiceFromLead(lead));
                const numbering = client.quote_settings?.numbering;
                setManualQuoteNumber(numbering?.enabled && numbering.next_number ? numbering.next_number : '');
                setItems([{ id: crypto.randomUUID(), description: '', quantity: '1', price: '0', vat: '22' }]);
                setNotes('');
                setTermsAndConditions(getDefaultTerms(getServiceFromLead(lead)));
            }
            setLeftTab('lead');
        }
    }, [isOpen, quoteToEdit, isEditing, lead, client]);

    const { taxableAmount, vatAmount, totalAmount } = useMemo(() => {
        let taxable = 0;
        let vat = 0;
        items.forEach(item => {
            const quantity = parseFloat(item.quantity.replace(',', '.')) || 0;
            const price = parseFloat(item.price.replace(',', '.')) || 0;
            const vatPerc = parseFloat(item.vat.replace(',', '.')) || 0;
            const itemSubtotal = quantity * price;
            taxable += itemSubtotal;
            vat += itemSubtotal * ((vatPerc) / 100);
        });
        return {
            taxableAmount: taxable,
            vatAmount: vat,
            totalAmount: taxable + vat
        };
    }, [items]);

    const getFieldLabel = (key: string): string => {
        for (const svc of client.services || []) {
            const field = svc.fields.find(f => f.name === key);
            if (field) return field.label;
        }
        return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
    };

    const leadDataEntries = useMemo(() => {
        const technicalFields = ['ip_address', 'user_agent', '_is_historical'];
        return Object.entries(lead.data || {}).filter(([key, value]) => !technicalFields.includes(key) && value !== '' && value !== null && value !== undefined);
    }, [lead]);

    const sortedPresets = useMemo(() => {
        const presets = client.quote_settings?.price_presets || [];
        const detectedService = getServiceFromLead(lead);
        const matching = presets.filter(p => p.service !== '*' && p.service === detectedService);
        const others = presets.filter(p => !(p.service !== '*' && p.service === detectedService));
        return [...matching, ...others].map(p => ({ ...p, isMatch: matching.includes(p) }));
    }, [client.quote_settings, lead]);
    
    const handleItemChange = (index: number, field: keyof Omit<QuoteItemForState, 'id'>, value: string) => {
        const updatedItems = [...items];
        const currentItem = updatedItems[index];
        
        if (field === 'description') {
            currentItem.description = value;

            const matchedPreset = (client.quote_settings?.price_presets || [])
                .find(p => p.description.trim().toLowerCase() === value.trim().toLowerCase());
            if (matchedPreset) {
                currentItem.price = String(matchedPreset.price).replace('.', ',');
                currentItem.vat = String(matchedPreset.vat).replace('.', ',');
            }
        } else {
            const sanitizedValue = value.replace('.', ',');
            if ((sanitizedValue.match(/,/g) || []).length > 1 || !/^[0-9]*?,?[0-9]*$/.test(sanitizedValue)) {
                return;
            }
            (currentItem as any)[field] = sanitizedValue;
        }
        
        setItems(updatedItems);
    };

    const handleAddItem = () => {
        setItems([...items, { id: crypto.randomUUID(), description: '', quantity: '1', price: '0', vat: '22' }]);
    };

    const handleAddPresetItem = (preset: QuotePricePreset) => {
        setItems([...items, {
            id: crypto.randomUUID(),
            description: preset.description,
            quantity: '1',
            price: String(preset.price).replace('.', ','),
            vat: String(preset.vat).replace('.', ','),
        }]);
    };

    const handleRemoveItem = (id: string) => {
        const updatedItems = items.filter((item) => item.id !== id);
        setItems(updatedItems);
    };
    
    const handleVehicleDetailChange = (key: string, value: string) => {
        setVehicleDetails(prev => ({...prev, [key]: value}));
    };

    const handleServiceSourceChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const fieldName = e.target.value;
        if (fieldName) { // If a field is selected
            setService(lead.data[fieldName] || '');
        }
    };

    const handleSubmit = async () => {
        setError('');
        if (items.some(item => !item.description.trim())) {
            setError("La descrizione di ogni riga è obbligatoria.");
            return;
        }
        setIsLoading(true);
        
        try {
            const isFacchetti = client.name.toLowerCase().includes('facche');
            const finalVehicleDetails = { ...vehicleDetails };
            
            let finalQuoteNumber = manualQuoteNumber;
            if (isFacchetti && service) {
                finalVehicleDetails['Servizio'] = service;
                finalQuoteNumber = `${manualQuoteNumber} ${service}`.trim();
            }
            
            const itemsForApi: Omit<QuoteItem, 'id'>[] = items.map(({ id, ...rest }) => ({
                description: rest.description,
                quantity: parseFloat(rest.quantity.replace(',', '.')) || 0,
                price: parseFloat(rest.price.replace(',', '.')) || 0,
                vat: parseFloat(rest.vat.replace(',', '.')) || 0,
            }));

            const quotePayload = {
                client_id: client.id,
                lead_id: lead.id,
                quote_date: quoteDate,
                due_date: dueDate,
                recipient_name: recipientName,
                vehicle_details: finalVehicleDetails,
                notes,
                terms_and_conditions: termsAndConditions,
                quote_number_display: finalQuoteNumber,
                taxable_amount: taxableAmount,
                vat_amount: vatAmount,
                total_amount: totalAmount,
                payment_type: "Nessun Pagamento Predefinito", // Hardcoded for now
                items: itemsForApi,
            };
            
            let savedQuote: Quote;
            if(isEditing && quoteToEdit) {
                savedQuote = await ApiService.updateQuote(quoteToEdit.id, quotePayload as Partial<Omit<Quote, 'id' | 'created_at'>>);
            } else {
                savedQuote = await ApiService.saveQuote(quotePayload as Omit<Quote, 'id' | 'created_at' | 'status'>);

                const numbering = client.quote_settings?.numbering;
                if (numbering?.enabled && numbering.next_number) {
                    try {
                        await ApiService.updateClient(client.id, {
                            quote_settings: {
                                ...client.quote_settings,
                                numbering: { ...numbering, next_number: incrementQuoteNumber(numbering.next_number) },
                            },
                        });
                    } catch {
                        // Non bloccare il salvataggio del preventivo se l'incremento fallisce
                    }
                }
            }
            onSave(savedQuote);
        } catch (err: any) {
            setError(err.message || "Si è verificato un errore durante il salvataggio.");
        } finally {
            setIsLoading(false);
        }
    };

    const formatCurrency = (value: number) => value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    return (
        <Modal isOpen={isOpen} onClose={onClose} title={isEditing ? "Modifica Preventivo" : "Crea Nuovo Preventivo"} size="extra-large">
            <datalist id="description-suggestions">
                {descriptionSuggestions.map(suggestion => (
                    <option key={suggestion} value={suggestion} />
                ))}
            </datalist>
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Lead Details Panel */}
                <div className="lg:col-span-2 lg:order-1">
                    <div className="lg:sticky lg:top-0 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 lg:max-h-[75vh] lg:overflow-y-auto">
                        <div className="flex items-center gap-1 mb-3 border-b border-slate-200 dark:border-slate-700">
                            <button
                                type="button"
                                onClick={() => setLeftTab('lead')}
                                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                    leftTab === 'lead'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <Tag size={14} /> Dettagli Lead
                            </button>
                            <button
                                type="button"
                                onClick={() => setLeftTab('preview')}
                                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-semibold border-b-2 -mb-px transition-colors ${
                                    leftTab === 'preview'
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                                }`}
                            >
                                <Eye size={14} /> Anteprima
                            </button>
                        </div>
                        {leftTab === 'lead' ? (
                        <div className="space-y-2.5">
                            {lead.data.nome && (
                                <div className="flex items-start gap-2">
                                    <User size={14} className="mt-0.5 text-slate-400 dark:text-gray-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Nome</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white break-words">{lead.data.nome}</p>
                                    </div>
                                </div>
                            )}
                            {lead.data.telefono && (
                                <div className="flex items-start gap-2">
                                    <Phone size={14} className="mt-0.5 text-slate-400 dark:text-gray-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Telefono</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white break-words">{lead.data.telefono}</p>
                                    </div>
                                </div>
                            )}
                            {(lead.data.mail || lead.data.email) && (
                                <div className="flex items-start gap-2">
                                    <Mail size={14} className="mt-0.5 text-slate-400 dark:text-gray-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Email</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white break-words">{lead.data.mail || lead.data.email}</p>
                                    </div>
                                </div>
                            )}
                            {lead.created_at && (
                                <div className="flex items-start gap-2">
                                    <Calendar size={14} className="mt-0.5 text-slate-400 dark:text-gray-500 shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs text-slate-500 dark:text-gray-400">Data ricezione</p>
                                        <p className="text-sm font-semibold text-slate-800 dark:text-white break-words">{new Date(lead.created_at).toLocaleString('it-IT')}</p>
                                    </div>
                                </div>
                            )}

                            {leadDataEntries.length > 0 && (
                                <div className="pt-2 mt-2 border-t border-slate-200 dark:border-slate-700 space-y-2.5">
                                    {leadDataEntries
                                        .filter(([key]) => !['nome', 'telefono', 'mail', 'email'].includes(key))
                                        .map(([key, value]) => (
                                        <div key={key} className="min-w-0">
                                            <p className="text-xs text-slate-500 dark:text-gray-400">{getFieldLabel(key)}</p>
                                            <p className="text-sm font-semibold text-slate-800 dark:text-white break-words">{String(value)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        ) : (
                        <div className="overflow-auto" style={{ maxHeight: '75vh' }}>
                            <div style={{ zoom: 0.6 } as React.CSSProperties}>
                                <QuotePreviewDocument
                                    clientName={client.name}
                                    branding={client.quote_settings?.branding}
                                    data={{
                                        quoteNumber: client.name.toLowerCase().includes('facche') ? `${manualQuoteNumber} ${service}`.trim() : manualQuoteNumber,
                                        quoteDate,
                                        dueDate,
                                        recipientName,
                                        vehicleDetails,
                                        items: items.map(item => ({
                                            description: item.description,
                                            quantity: parseFloat(item.quantity.replace(',', '.')) || 0,
                                            price: parseFloat(item.price.replace(',', '.')) || 0,
                                            vat: parseFloat(item.vat.replace(',', '.')) || 0,
                                        })),
                                        notes,
                                        termsAndConditions,
                                        taxableAmount,
                                        vatAmount,
                                        totalAmount,
                                    }}
                                />
                            </div>
                        </div>
                        )}
                    </div>
                </div>

                {/* Quote Form */}
                <div className="lg:col-span-3 lg:order-2 space-y-6">
                {/* Header Section */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">N. Preventivo</label>
                        {client.name.toLowerCase().includes('facche') ? (
                            <div className="mt-1 flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={manualQuoteNumber} 
                                    onChange={e => setManualQuoteNumber(e.target.value.toUpperCase().substring(0, 8))} 
                                    maxLength={8}
                                    className="w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm" 
                                    placeholder="Es. 862"
                                />
                                <span className="p-2 bg-slate-100 dark:bg-slate-700 rounded-md text-sm text-slate-600 dark:text-gray-300 whitespace-nowrap truncate flex-1" title={service}>
                                    {service}
                                </span>
                            </div>
                        ) : (
                            <input 
                                type="text" 
                                value={manualQuoteNumber} 
                                onChange={e => setManualQuoteNumber(e.target.value.toUpperCase().substring(0, 8))}
                                maxLength={8}
                                className="mt-1 w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm" 
                                placeholder="Es. 862"
                            />
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Data Preventivo</label>
                        <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)} required className="mt-1 w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm"/>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Data Scadenza</label>
                        <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1 w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm"/>
                    </div>
                    <div className="md:col-span-3">
                         <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Destinatario</label>
                         <input type="text" value={recipientName} onChange={e => setRecipientName(e.target.value)} required className="mt-1 w-full p-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-md text-sm"/>
                    </div>
                </div>

                {/* Service and Vehicle Details */}
                {client.name.toLowerCase().includes('facche') && (
                    <div className="mb-4">
                        <label htmlFor="quote-service" className="block text-sm font-medium text-slate-700 dark:text-gray-300">Servizio</label>
                        <div className="flex items-center gap-2 mt-1">
                            <input
                                id="quote-service"
                                type="text" 
                                value={service} 
                                onChange={e => setService(e.target.value)} 
                                className="flex-grow w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"
                                placeholder="Es. Tagliando motore completo"
                            />
                            <div className="relative flex-shrink-0">
                                <select 
                                    onChange={handleServiceSourceChange} 
                                    className="appearance-none p-2 pl-3 pr-8 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm cursor-pointer hover:bg-slate-200 dark:hover:bg-slate-600"
                                    aria-label="Popola servizio da un campo del lead"
                                    defaultValue=""
                                >
                                    <option value="" disabled>Popola da...</option>
                                    {Object.keys(lead.data)
                                        .filter(key => !['_is_historical', 'ip_address', 'user_agent'].includes(key))
                                        .map(key => (
                                            <option key={key} value={key}>{key}</option>
                                        ))
                                    }
                                </select>
                                <ChevronDown size={16} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 dark:text-gray-400" />
                            </div>
                        </div>
                    </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                     {Object.entries(vehicleDetails).map(([key, value]) => (
                        <div key={key}>
                            <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">{key}</label>
                            <input type="text" value={value} onChange={e => handleVehicleDetailChange(key, e.target.value)} className="mt-1 w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"/>
                        </div>
                    ))}
                </div>

                {/* Preset rapidi */}
                {sortedPresets.length > 0 && (
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Preset rapidi</label>
                        <div className="flex flex-wrap gap-2">
                            {sortedPresets.map(preset => (
                                <button
                                    key={preset.id}
                                    type="button"
                                    onClick={() => handleAddPresetItem(preset)}
                                    title={`${preset.description} — ${preset.price.toFixed(2)} € / ${preset.unit || 'unità'} (IVA ${preset.vat}%)`}
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
                                        preset.isMatch
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300'
                                            : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-gray-300 hover:border-slate-300 dark:hover:border-slate-600'
                                    }`}
                                >
                                    <Plus size={12} /> {preset.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Line Items Table */}
                <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                        <thead className="bg-slate-100 dark:bg-slate-700">
                            <tr>
                                <th className="p-2 text-left font-semibold">Descrizione</th>
                                <th className="p-2 text-left font-semibold w-24">Q.tà</th>
                                <th className="p-2 text-left font-semibold w-32">Prezzo (€)</th>
                                <th className="p-2 text-left font-semibold w-24">IVA (%)</th>
                                <th className="p-2 text-right font-semibold w-32">Totale (€)</th>
                                <th className="p-2 w-10"></th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item, index) => {
                                const lineTotal = (parseFloat(item.quantity.replace(',','.')) || 0) * (parseFloat(item.price.replace(',','.')) || 0);
                                return (
                                <tr key={item.id} className="border-b border-slate-200 dark:border-slate-700">
                                    <td className="p-1"><input type="text" value={item.description} onChange={e => handleItemChange(index, 'description', e.target.value)} className="w-full p-1 bg-transparent border-slate-300 dark:border-slate-600 rounded-md" placeholder="Descrizione" list="description-suggestions"/></td>
                                    <td className="p-1"><input type="text" inputMode="decimal" value={item.quantity} onChange={e => handleItemChange(index, 'quantity', e.target.value)} className="w-full p-1 bg-transparent border-slate-300 dark:border-slate-600 rounded-md text-right"/></td>
                                    <td className="p-1"><input type="text" inputMode="decimal" value={item.price} onChange={e => handleItemChange(index, 'price', e.target.value)} className="w-full p-1 bg-transparent border-slate-300 dark:border-slate-600 rounded-md text-right"/></td>
                                    <td className="p-1"><input type="text" inputMode="decimal" value={item.vat} onChange={e => handleItemChange(index, 'vat', e.target.value)} className="w-full p-1 bg-transparent border-slate-300 dark:border-slate-600 rounded-md text-right"/></td>
                                    <td className="p-1 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                                    <td className="p-1 text-center">
                                        <button onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:text-red-700 p-1 rounded-full"><Trash2 size={16}/></button>
                                    </td>
                                </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
                <button onClick={handleAddItem} className="flex items-center text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500">
                    <Plus size={16} className="mr-1"/> Aggiungi Riga
                </button>
                
                {/* Notes and Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Note Documento</label>
                        <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={4} className="mt-1 w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"/>
                    </div>
                    <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg space-y-2 text-sm">
                        <div className="flex justify-between"><span>Imponibile</span> <span className="font-semibold">{formatCurrency(taxableAmount)} €</span></div>
                        <div className="flex justify-between"><span>IVA</span> <span className="font-semibold">{formatCurrency(vatAmount)} €</span></div>
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-300 dark:border-slate-600"><span>TOTALE</span> <span>{formatCurrency(totalAmount)} €</span></div>
                    </div>
                </div>

                {/* Terms and Conditions */}
                <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-slate-700 dark:text-gray-300">Termini e Condizioni</label>
                        <button
                            type="button"
                            onClick={() => setTermsAndConditions(getDefaultTerms(service))}
                            className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500"
                        >
                            <RotateCcw size={12} /> Ripristina default
                        </button>
                    </div>
                    <textarea
                        value={termsAndConditions}
                        onChange={e => setTermsAndConditions(e.target.value)}
                        rows={4}
                        className="w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm"
                        placeholder="Es. Pagamento a 30 giorni dalla data di emissione del preventivo..."
                    />
                </div>

                {error && <p className="text-sm text-red-500 text-center">{error}</p>}

                <div className="flex justify-end space-x-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={onClose} className="bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white px-4 py-2 rounded-lg hover:bg-slate-300 dark:hover:bg-slate-500">Annulla</button>
                    <button onClick={handleSubmit} disabled={isLoading} className="bg-primary-600 text-white px-4 py-2 rounded-lg shadow hover:bg-primary-700 disabled:opacity-50 flex items-center">
                        {isLoading ? <Loader2 size={18} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                        {isLoading ? "Salvataggio..." : "Salva Preventivo"}
                    </button>
                </div>
                </div>
            </div>
        </Modal>
    );
};

export default QuoteCreatorModal;