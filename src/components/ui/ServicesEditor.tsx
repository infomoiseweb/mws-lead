import React, { useState } from 'react';
import type { Service, LeadField, LeadFieldType } from '../types';
import { PlusCircle, Trash2, Tag, ChevronDown, ChevronUp, GripVertical, Layers, Sparkles, FileCode, Globe, Copy, Check } from 'lucide-react';
import Modal from './Modal';
import { useTranslation } from 'react-i18next';

const fieldTypes: { value: LeadFieldType; label: string }[] = [
    { value: 'text', label: 'Testo' },
    { value: 'email', label: 'Email' },
    { value: 'textarea', label: 'Area di Testo' },
    { value: 'tel', label: 'Telefono' },
    { value: 'number', label: 'Numero' },
    { value: 'date', label: 'Data' },
    { value: 'time', label: 'Ora' },
    { value: 'password', label: 'Password' },
    { value: 'url', label: 'URL' },
    { value: 'checkbox', label: 'Checkbox' },
    { value: 'radio', label: 'Radio' },
    { value: 'select', label: 'Seleziona Opzioni' },
    { value: 'file', label: 'Caricamento File' },
];

export type ServiceState = Omit<Service, 'id'> & { id?: string; isExpanded?: boolean };

interface ServicesEditorProps {
    services: ServiceState[];
    onChange: (services: ServiceState[]) => void;
    defaultIntakeMode?: 'form' | 'api';
}

const ServicesEditor: React.FC<ServicesEditorProps> = ({ services, onChange, defaultIntakeMode = 'form' }) => {
    const { t } = useTranslation();
    const [copiedFieldName, setCopiedFieldName] = useState<string | null>(null);
    const [draggedField, setDraggedField] = useState<{ serviceIndex: number; fieldIndex: number } | null>(null);
    const [deleteServiceConfirm, setDeleteServiceConfirm] = useState<{ isOpen: boolean; serviceIndex: number | null }>({ isOpen: false, serviceIndex: null });

    const copyFieldName = (name: string, id: string) => {
        navigator.clipboard.writeText(name);
        setCopiedFieldName(id);
        setTimeout(() => setCopiedFieldName(prev => (prev === id ? null : prev)), 1500);
    };

    const handleServiceChange = (index: number, newName: string) => {
        const updated = [...services];
        updated[index] = { ...updated[index], name: newName };
        onChange(updated);
    };

    const handleAddService = () => {
        onChange([...services, {
            name: '',
            id: `new_${Date.now()}_${Math.random()}`,
            fields: [],
            intake_mode: defaultIntakeMode,
            isExpanded: true,
        }]);
    };

    const handleServiceIntakeModeChange = (index: number, mode: 'form' | 'api') => {
        const updated = [...services];
        updated[index] = { ...updated[index], intake_mode: mode };
        onChange(updated);
    };

    const handleDuplicateService = (index: number) => {
        const src = services[index];
        const copy: ServiceState = {
            ...src,
            id: `new_${Date.now()}_${Math.random()}`,
            name: `${src.name} (copia)`,
            fields: src.fields.map(f => ({ ...f, id: `field_${Date.now()}_${Math.random()}` })),
            isExpanded: true,
        };
        const updated = [...services];
        updated.splice(index + 1, 0, copy);
        onChange(updated);
    };

    const handleRemoveService = (index: number) => {
        if (services[index]?.is_base) return;
        setDeleteServiceConfirm({ isOpen: true, serviceIndex: index });
    };

    const confirmRemoveService = () => {
        if (deleteServiceConfirm.serviceIndex !== null) {
            const updated = [...services];
            updated.splice(deleteServiceConfirm.serviceIndex, 1);
            onChange(updated);
        }
        setDeleteServiceConfirm({ isOpen: false, serviceIndex: null });
    };

    const handleFieldPropertyChange = (serviceIndex: number, fieldIndex: number, propName: keyof LeadField, value: any) => {
        const updated = [...services];
        const fields = [...updated[serviceIndex].fields];
        const field = { ...fields[fieldIndex] } as any;

        field[propName] = value;
        if (propName === 'label') {
            field.name = (value as string).toLowerCase().replace(/\s+/g, '_').replace(/[^\w-]/g, '');
        }
        if (propName === 'type') {
            if (value !== 'radio' && value !== 'select') delete field.options;
            else if (!field.options) field.options = [];
        }

        fields[fieldIndex] = field;
        updated[serviceIndex] = { ...updated[serviceIndex], fields };
        onChange(updated);
    };

    const handleAddField = (serviceIndex: number) => {
        const updated = [...services];
        updated[serviceIndex] = {
            ...updated[serviceIndex],
            fields: [...updated[serviceIndex].fields, { id: `new_${Date.now()}_${Math.random()}`, label: '', name: '', type: 'text', required: false }],
        };
        onChange(updated);
    };

    const handleRemoveField = (serviceIndex: number, fieldIndex: number) => {
        const updated = [...services];
        const fields = [...updated[serviceIndex].fields];
        fields.splice(fieldIndex, 1);
        updated[serviceIndex] = { ...updated[serviceIndex], fields };
        onChange(updated);
    };

    const handleDragStart = (e: React.DragEvent, serviceIndex: number, fieldIndex: number) => {
        setDraggedField({ serviceIndex, fieldIndex });
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e: React.DragEvent) => e.preventDefault();

    const handleDrop = (e: React.DragEvent, targetServiceIndex: number, targetFieldIndex: number) => {
        e.preventDefault();
        if (!draggedField || draggedField.serviceIndex !== targetServiceIndex || draggedField.fieldIndex === targetFieldIndex) {
            setDraggedField(null);
            return;
        }
        const { serviceIndex, fieldIndex: fromIndex } = draggedField;
        const updated = [...services];
        const fields = [...updated[serviceIndex].fields];
        const [removed] = fields.splice(fromIndex, 1);
        fields.splice(targetFieldIndex, 0, removed);
        updated[serviceIndex] = { ...updated[serviceIndex], fields };
        onChange(updated);
        setDraggedField(null);
    };

    const handleDragEnd = () => setDraggedField(null);

    const toggleServiceExpand = (index: number) => {
        const updated = [...services];
        updated[index] = { ...updated[index], isExpanded: !updated[index].isExpanded };
        onChange(updated);
    };

    const fieldInputClasses = "w-full px-2 py-1.5 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm";
    const fieldLabelClasses = "text-xs font-medium text-slate-500 dark:text-gray-400";
    const actionButtonClasses = "p-1.5 rounded-md text-slate-500 dark:text-gray-400 hover:bg-slate-200 dark:hover:bg-slate-600 disabled:opacity-40 disabled:cursor-not-allowed";

    return (
        <>
            <div className="space-y-4">
                {services.map((service, serviceIndex) => (
                    <div key={service.id || serviceIndex} className="bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex items-center p-3 cursor-pointer" onClick={() => toggleServiceExpand(serviceIndex)}>
                            {service.is_base ? <Layers className="mr-2 text-indigo-500 dark:text-indigo-400" size={18} /> : <Tag className="mr-2 text-primary-500 dark:text-primary-400" size={18} />}
                            <input
                                type="text"
                                placeholder="Nome Servizio (es. Tagliando)"
                                value={service.name}
                                onChange={e => handleServiceChange(serviceIndex, e.target.value)}
                                onClick={e => e.stopPropagation()}
                                className="flex-grow font-bold bg-transparent focus:outline-none focus:ring-0 border-0 p-0 text-slate-900 dark:text-white"
                            />
                            <button
                                type="button"
                                onClick={(e) => { e.stopPropagation(); handleDuplicateService(serviceIndex); }}
                                title="Duplica servizio"
                                className="p-2 text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 ml-1"
                            >
                                <Copy size={15} />
                            </button>
                            {!service.is_base && (
                                <button type="button" onClick={(e) => { e.stopPropagation(); handleRemoveService(serviceIndex); }} className="p-2 text-red-500 hover:text-red-400 ml-1">
                                    <Trash2 size={16} />
                                </button>
                            )}
                            {service.isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>

                        {service.isExpanded && (
                            <div className="p-4 border-t border-slate-200 dark:border-slate-700 space-y-3 bg-white dark:bg-slate-950/40">
                                <div className="flex items-center space-x-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-2 rounded-md font-medium">
                                    <Sparkles size={14} />
                                    <span>
                                        {service.is_base
                                            ? 'Questo è il servizio base: i suoi campi vengono inclusi automaticamente in tutti gli altri servizi.'
                                            : 'Questo servizio includerà automaticamente tutti i campi del servizio base.'}
                                    </span>
                                </div>

                                <div>
                                    <label className={fieldLabelClasses}>Modalità Ricezione Lead per questo servizio</label>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                                        <label className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                                            (service.intake_mode || 'form') === 'form'
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}>
                                            <input
                                                type="radio"
                                                name={`service-intake-mode-${serviceIndex}`}
                                                value="form"
                                                checked={(service.intake_mode || 'form') === 'form'}
                                                onChange={() => handleServiceIntakeModeChange(serviceIndex, 'form')}
                                                className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                            />
                                            <Globe size={14} className="text-primary-500" />
                                            <span>Formulario HTML</span>
                                        </label>
                                        <label className={`flex items-center gap-2 px-3 py-2 rounded-md border cursor-pointer text-sm transition-colors ${
                                            service.intake_mode === 'api'
                                                ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                                                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                                        }`}>
                                            <input
                                                type="radio"
                                                name={`service-intake-mode-${serviceIndex}`}
                                                value="api"
                                                checked={service.intake_mode === 'api'}
                                                onChange={() => handleServiceIntakeModeChange(serviceIndex, 'api')}
                                                className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                                            />
                                            <FileCode size={14} className="text-primary-500" />
                                            <span>API / Integrazione Esterna</span>
                                        </label>
                                    </div>
                                </div>

                                <h4 className="text-xs font-bold text-slate-500 dark:text-gray-400 uppercase tracking-wider">
                                    {service.is_base
                                        ? 'Campi base (condivisi con tutti i servizi):'
                                        : `Campi extra unici per "${service.name || 'Filtro vuoto'}":`}
                                </h4>
                                {service.fields.map((field, fieldIndex) => (
                                    <div
                                        key={field.id || fieldIndex}
                                        draggable
                                        onDragStart={(e) => handleDragStart(e, serviceIndex, fieldIndex)}
                                        onDragOver={handleDragOver}
                                        onDrop={(e) => handleDrop(e, serviceIndex, fieldIndex)}
                                        onDragEnd={handleDragEnd}
                                        className={`flex items-start gap-x-1 p-3 bg-slate-50 dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 transition-opacity ${
                                            draggedField?.fieldIndex === fieldIndex && draggedField?.serviceIndex === serviceIndex ? 'opacity-40' : 'opacity-100'
                                        }`}
                                    >
                                        <div className="cursor-move text-slate-400 dark:text-gray-500 pt-7" title="Trascina per riordinare">
                                            <GripVertical size={20} />
                                        </div>
                                        <div className="flex-grow grid grid-cols-12 gap-x-4 gap-y-2 items-center">
                                            <div className="col-span-12 md:col-span-5">
                                                <label className={fieldLabelClasses}>Etichetta Campo</label>
                                                <input
                                                    type="text"
                                                    placeholder="Es. Targa Veicolo"
                                                    value={field.label}
                                                    onChange={e => handleFieldPropertyChange(serviceIndex, fieldIndex, 'label', e.target.value)}
                                                    className={fieldInputClasses}
                                                />
                                            </div>
                                            <div className="col-span-12 md:col-span-4">
                                                <label className={fieldLabelClasses}>Tipo Campo</label>
                                                <select
                                                    value={field.type}
                                                    onChange={(e) => handleFieldPropertyChange(serviceIndex, fieldIndex, 'type', e.target.value as LeadFieldType)}
                                                    className={fieldInputClasses}
                                                >
                                                    {fieldTypes.map(ft => <option key={ft.value} value={ft.value}>{ft.label}</option>)}
                                                </select>
                                            </div>
                                            <div className="col-span-12 md:col-span-2 flex items-center self-end pb-1.5 font-medium">
                                                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-650 dark:text-gray-400">
                                                    <input
                                                        type="checkbox"
                                                        checked={!!field.required}
                                                        onChange={e => handleFieldPropertyChange(serviceIndex, fieldIndex, 'required', e.target.checked)}
                                                        className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                                                    />
                                                    <span>Obbligatorio</span>
                                                </label>
                                            </div>
                                            <div className="col-span-12 md:col-span-1 flex items-center justify-end self-end pb-1.5">
                                                <button type="button" onClick={() => handleRemoveField(serviceIndex, fieldIndex)} className={`${actionButtonClasses} text-red-500 hover:bg-red-500/10`}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>

                                            <div className="col-span-12 md:col-span-5">
                                                <label className={fieldLabelClasses}>Nome Chiave (API)</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={field.name}
                                                        readOnly
                                                        className="w-full px-2 py-1 pr-7 bg-slate-200 dark:bg-slate-900/50 border border-slate-300 dark:border-slate-600 rounded-md text-gray-500 dark:text-gray-400 text-xs"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => copyFieldName(field.name, `service-${field.id}`)}
                                                        title="Copia nome chiave"
                                                        className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-primary-500 transition"
                                                    >
                                                        {copiedFieldName === `service-${field.id}` ? <Check size={13} className="text-green-500" /> : <Copy size={13} />}
                                                    </button>
                                                </div>
                                            </div>
                                            {(field.type === 'select' || field.type === 'radio') && (
                                                <div className="col-span-12 md:col-span-7">
                                                    <label className={fieldLabelClasses}>Opzioni (separate da punto e virgola ';')</label>
                                                    <input
                                                        type="text"
                                                        placeholder="Opzione 1; Opzione 2; Opzione con spazi"
                                                        value={field.options?.join(';') || ''}
                                                        onChange={e => handleFieldPropertyChange(serviceIndex, fieldIndex, 'options', (e.target.value || '').split(';'))}
                                                        className={`w-full ${fieldInputClasses}`}
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={() => handleAddField(serviceIndex)}
                                    className="mt-2 flex items-center text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-500"
                                >
                                    <PlusCircle size={15} className="mr-1" />
                                    {service.is_base ? 'Aggiungi Campo Base' : `Aggiungi Campo Extra per ${service.name || 'questo servizio'}`}
                                </button>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            <button
                type="button"
                onClick={handleAddService}
                className="mt-4 flex items-center text-sm font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-gray-250 hover:bg-slate-200 dark:hover:bg-slate-750 px-4 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700"
            >
                <PlusCircle size={18} className="mr-2 text-primary-500" />
                Aggiungi Nuovo Servizio Specifico
            </button>

            <Modal
                isOpen={deleteServiceConfirm.isOpen}
                onClose={() => setDeleteServiceConfirm({ isOpen: false, serviceIndex: null })}
                title={t('component_clientForm.confirm_delete_service_title')}
            >
                <p className="text-slate-600 dark:text-gray-300">
                    {t('component_clientForm.confirm_delete_service_message', {
                        serviceName: deleteServiceConfirm.serviceIndex !== null && services[deleteServiceConfirm.serviceIndex] ? services[deleteServiceConfirm.serviceIndex].name : ''
                    })}
                </p>
                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        type="button"
                        onClick={() => setDeleteServiceConfirm({ isOpen: false, serviceIndex: null })}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white hover:bg-slate-300 dark:hover:bg-slate-500"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        type="button"
                        onClick={confirmRemoveService}
                        className="px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700"
                    >
                        {t('delete')}
                    </button>
                </div>
            </Modal>
        </>
    );
};

export default ServicesEditor;
