import React, { useState } from 'react';
import type { Client, MessageTemplate, Service } from '../../types';
import { PlusCircle, Trash2, Edit2, Save, X, MessageSquare, Mail, Smartphone } from 'lucide-react';

interface Props {
    client: Client;
    onSave: (templates: MessageTemplate[]) => Promise<void>;
}

const CHANNEL_LABELS = {
    whatsapp: { label: 'WhatsApp', icon: <Smartphone className="w-3.5 h-3.5" /> },
    email: { label: 'Email', icon: <Mail className="w-3.5 h-3.5" /> },
    entrambi: { label: 'Entrambi', icon: <MessageSquare className="w-3.5 h-3.5" /> },
};

const AVAILABLE_VARS = ['{{nome}}', '{{telefono}}', '{{email}}', '{{servizio}}', '{{data}}'];

const emptyTemplate = (services: Service[]): MessageTemplate => ({
    id: `tpl_${Date.now()}_${Math.random()}`,
    name: '',
    service: services[0]?.name || '*',
    channel: 'whatsapp',
    body: '',
});

const MessageTemplatesSettings: React.FC<Props> = ({ client, onSave }) => {
    const [templates, setTemplates] = useState<MessageTemplate[]>(client.message_templates || []);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editBuffer, setEditBuffer] = useState<MessageTemplate | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const services = (client.services || []).filter(s => s.name !== '__default_fields__');

    const startEdit = (tpl: MessageTemplate) => {
        setEditingId(tpl.id);
        setEditBuffer({ ...tpl });
    };

    const startNew = () => {
        const tpl = emptyTemplate(services);
        setTemplates(prev => [...prev, tpl]);
        setEditingId(tpl.id);
        setEditBuffer({ ...tpl });
    };

    const cancelEdit = () => {
        // Se il template era nuovo (body e name vuoti) rimuovilo
        setTemplates(prev => prev.filter(t => !(t.id === editingId && !t.name && !t.body)));
        setEditingId(null);
        setEditBuffer(null);
    };

    const saveEdit = () => {
        if (!editBuffer?.name.trim() || !editBuffer?.body.trim()) return;
        setTemplates(prev => prev.map(t => t.id === editingId ? { ...editBuffer } : t));
        setEditingId(null);
        setEditBuffer(null);
    };

    const deleteTemplate = (id: string) => {
        setTemplates(prev => prev.filter(t => t.id !== id));
    };

    const insertVar = (variable: string) => {
        if (!editBuffer) return;
        setEditBuffer({ ...editBuffer, body: editBuffer.body + variable });
    };

    const handleSaveAll = async () => {
        setIsSaving(true);
        try {
            await onSave(templates);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } finally {
            setIsSaving(false);
        }
    };

    const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Modelli Messaggi</h3>
                    <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                        Crea template per WhatsApp ed email da usare con le tue lead. Usa le variabili per personalizzarli automaticamente.
                    </p>
                </div>
                <button onClick={startNew} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors">
                    <PlusCircle className="w-3.5 h-3.5" /> Nuovo template
                </button>
            </div>

            {/* Variabili disponibili */}
            <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-xs text-slate-500 dark:text-gray-400 mr-1">Variabili disponibili:</span>
                {AVAILABLE_VARS.map(v => (
                    <span key={v} className="text-xs font-mono bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded">
                        {v}
                    </span>
                ))}
                <span className="text-xs text-slate-400 dark:text-gray-500">+ qualsiasi campo della lead es. <span className="font-mono">{'{{ettari}}'}</span></span>
            </div>

            {/* Lista template */}
            <div className="space-y-3">
                {templates.length === 0 && (
                    <p className="text-sm text-slate-400 dark:text-gray-500 text-center py-6 border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                        Nessun template. Clicca "Nuovo template" per iniziare.
                    </p>
                )}

                {templates.map(tpl => (
                    <div key={tpl.id} className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        {editingId === tpl.id && editBuffer ? (
                            /* Form modifica */
                            <div className="p-4 space-y-3 bg-white dark:bg-slate-800">
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                    <div className="sm:col-span-1">
                                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome template</label>
                                        <input
                                            type="text"
                                            value={editBuffer.name}
                                            onChange={e => setEditBuffer({ ...editBuffer, name: e.target.value })}
                                            placeholder="Es. Prima risposta irrorazione"
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
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Canale</label>
                                        <select value={editBuffer.channel} onChange={e => setEditBuffer({ ...editBuffer, channel: e.target.value as MessageTemplate['channel'] })} className={inputCls}>
                                            <option value="whatsapp">WhatsApp</option>
                                            <option value="email">Email</option>
                                            <option value="entrambi">Entrambi</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Testo del messaggio</label>
                                        <div className="flex gap-1">
                                            {AVAILABLE_VARS.map(v => (
                                                <button key={v} type="button" onClick={() => insertVar(v)}
                                                    className="text-xs font-mono bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-1.5 py-0.5 rounded hover:bg-primary-200 transition-colors">
                                                    +{v}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <textarea
                                        value={editBuffer.body}
                                        onChange={e => setEditBuffer({ ...editBuffer, body: e.target.value })}
                                        rows={5}
                                        placeholder={`Es. Buongiorno {{nome}}, la contatto riguardo alla sua richiesta di {{servizio}}...`}
                                        className={`${inputCls} resize-none`}
                                    />
                                </div>

                                <div className="flex gap-2 justify-end">
                                    <button onClick={cancelEdit} className="flex items-center gap-1 px-3 py-1.5 text-xs text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                        <X className="w-3.5 h-3.5" /> Annulla
                                    </button>
                                    <button onClick={saveEdit} disabled={!editBuffer.name.trim() || !editBuffer.body.trim()}
                                        className="flex items-center gap-1 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-medium rounded-lg transition-colors">
                                        <Save className="w-3.5 h-3.5" /> Salva template
                                    </button>
                                </div>
                            </div>
                        ) : (
                            /* Vista compatta */
                            <div className="flex items-start gap-3 p-3 bg-white dark:bg-slate-800">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium text-slate-800 dark:text-white truncate">{tpl.name}</span>
                                        <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-gray-400">
                                            {CHANNEL_LABELS[tpl.channel].icon}
                                            {CHANNEL_LABELS[tpl.channel].label}
                                        </span>
                                        {tpl.service !== '*' && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                                                {tpl.service}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-slate-400 dark:text-gray-500 line-clamp-2">{tpl.body}</p>
                                </div>
                                <div className="flex gap-1 shrink-0">
                                    <button onClick={() => startEdit(tpl)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md text-slate-400 hover:text-primary-500 transition-colors">
                                        <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button onClick={() => deleteTemplate(tpl.id)} className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md text-slate-400 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {templates.length > 0 && (
                <div className="flex justify-end pt-2 border-t border-slate-200 dark:border-slate-700">
                    <button onClick={handleSaveAll} disabled={isSaving || !!editingId}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-sm font-medium rounded-lg transition-colors">
                        {isSaving ? 'Salvataggio...' : saved ? '✓ Salvato!' : 'Salva tutti i template'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default MessageTemplatesSettings;
