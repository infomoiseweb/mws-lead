import React, { useEffect, useState } from 'react';
import Modal from '../ui/Modal';
import * as ApiService from '@api';
import type { MailTemplate, MailBranding } from '../../types';
import { Loader2, Trash2 } from 'lucide-react';
import { STARTER_TEMPLATES, LAYOUT_LABELS, renderPreview } from './templateLayouts';

const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";

const PREVIEW_VARS_BASE = {
    nome: 'Mario Rossi',
    unsubscribe_link: '#',
};

interface MailTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    template: MailTemplate | null;
    clientId: string;
    clientName: string;
    branding: MailBranding;
    onSaved: (template: MailTemplate) => void;
    onDeleted: (templateId: string) => void;
}

const MailTemplateModal: React.FC<MailTemplateModalProps> = ({ isOpen, onClose, template, clientId, clientName, branding, onSaved, onDeleted }) => {
    const [name, setName] = useState('');
    const [layout, setLayout] = useState<MailTemplate['layout']>('simple');
    const [subjectTemplate, setSubjectTemplate] = useState('');
    const [bodyHtml, setBodyHtml] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!isOpen) return;
        if (template) {
            setName(template.name);
            setLayout(template.layout);
            setSubjectTemplate(template.subject_template);
            setBodyHtml(template.body_html);
        } else {
            const starter = STARTER_TEMPLATES.simple;
            setName('');
            setLayout('simple');
            setSubjectTemplate(starter.subject);
            setBodyHtml(starter.body);
        }
        setError('');
    }, [isOpen, template]);

    const handleLayoutChange = (newLayout: MailTemplate['layout']) => {
        setLayout(newLayout);
        if (!template) {
            const starter = STARTER_TEMPLATES[newLayout];
            setSubjectTemplate(starter.subject);
            setBodyHtml(starter.body);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            setError('Inserisci un nome per il template.');
            return;
        }
        setIsSaving(true);
        setError('');
        try {
            const saved = await ApiService.saveMailTemplate({
                ...(template ? { id: template.id } : {}),
                client_id: clientId,
                name: name.trim(),
                layout,
                subject_template: subjectTemplate,
                body_html: bodyHtml,
            });
            onSaved(saved);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Errore durante il salvataggio del template.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!template) return;
        setIsDeleting(true);
        setError('');
        try {
            await ApiService.deleteMailTemplate(template.id);
            onDeleted(template.id);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'eliminazione del template.');
            setIsDeleting(false);
        }
    };

    const previewVars = {
        ...PREVIEW_VARS_BASE,
        logo_url: branding.logo_url || '',
        brand_name: branding.brand_name || clientName,
        primary_color: branding.primary_color || '#2563eb',
        secondary_color: branding.secondary_color || '#1e293b',
        footer_text: branding.footer_text || clientName,
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={template ? 'Modifica template' : 'Nuovo template'}
            size="extra-large"
            footer={
                <div className="flex items-center justify-between">
                    {template ? (
                        <button
                            onClick={handleDelete}
                            disabled={isDeleting || isSaving}
                            className="inline-flex items-center gap-1.5 px-3 py-2 text-red-500 hover:bg-red-500/10 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                        >
                            {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                            Elimina
                        </button>
                    ) : <span />}
                    <div className="flex items-center gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                            Annulla
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={isSaving || isDeleting}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                            Salva
                        </button>
                    </div>
                </div>
            }
        >
            <div className="space-y-4">
                {error && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{error}</div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome del template</label>
                        <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Es. Promo estiva" className={inputCls} />
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Layout di partenza</label>
                        <select value={layout} onChange={e => handleLayoutChange(e.target.value as MailTemplate['layout'])} className={inputCls}>
                            {Object.entries(LAYOUT_LABELS).map(([key, label]) => (
                                <option key={key} value={key}>{label}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Oggetto email</label>
                    <input type="text" value={subjectTemplate} onChange={e => setSubjectTemplate(e.target.value)} placeholder="Es. {{brand_name}}: una novità per te" className={inputCls} />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">HTML del corpo email</label>
                        <textarea
                            value={bodyHtml}
                            onChange={e => setBodyHtml(e.target.value)}
                            rows={18}
                            className={`${inputCls} font-mono text-xs`}
                            spellCheck={false}
                        />
                        <p className="text-xs text-slate-400 dark:text-gray-500 mt-1">
                            Placeholder disponibili: <code>{'{{nome}}'}</code>, <code>{'{{logo_url}}'}</code>, <code>{'{{brand_name}}'}</code>, <code>{'{{primary_color}}'}</code>, <code>{'{{secondary_color}}'}</code>, <code>{'{{footer_text}}'}</code>, <code>{'{{unsubscribe_link}}'}</code>.
                        </p>
                    </div>
                    <div>
                        <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Anteprima</label>
                        <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white">
                            <iframe
                                title="Anteprima email"
                                srcDoc={renderPreview(bodyHtml, previewVars)}
                                className="w-full h-[420px] bg-white"
                                sandbox=""
                            />
                        </div>
                    </div>
                </div>
            </div>
        </Modal>
    );
};

export default MailTemplateModal;
