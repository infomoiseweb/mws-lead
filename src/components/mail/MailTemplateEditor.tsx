import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    X, Code, LayoutGrid, ChevronUp, ChevronDown, Trash2,
    Loader2, Type, MousePointer, ImageIcon, Minus, AlignLeft, Check, Upload
} from 'lucide-react';
import { renderPreview } from './templateLayouts';
import * as ApiService from '@api';
import { uploadMailLogo } from '@api/storage';
import type { MailTemplate, MailBranding } from '../../types';

// ─── Block types ────────────────────────────────────────────────────────────

type BlockType = 'header' | 'text' | 'button' | 'image' | 'logo' | 'divider' | 'footer';
type LogoAlign = 'left' | 'center' | 'right';

interface Block {
    id: string;
    type: BlockType;
    // header
    title?: string;
    // text
    content?: string;
    // button
    label?: string;
    url?: string;
    // image
    src?: string;
    alt?: string;
    // logo
    logoSrc?: string;
    logoAlign?: LogoAlign;
    logoWidth?: number;
    logoBg?: string;
}

function genId() { return Math.random().toString(36).slice(2, 9); }

function blocksToHtml(blocks: Block[]): string {
    const parts: string[] = [
        `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">`
    ];
    for (const b of blocks) {
        switch (b.type) {
            case 'header': {
                const headerAlign = b.logoAlign || 'center';
                const headerContent = b.logoSrc
                    ? `<img src="${b.logoSrc}" alt="Logo" style="width: ${b.logoWidth || 160}px; max-width: 100%; display: inline-block;" />`
                    : `<h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 600;">${b.title || '{{brand_name}}'}</h1>`;
                parts.push(
                    `<div style="background: {{secondary_color}}; padding: 24px; text-align: ${headerAlign};">` +
                    headerContent +
                    `</div>`
                );
                break;
            }
            case 'text':
                parts.push(
                    `<div style="padding: 20px 24px; background: #ffffff; color: #111827;">` +
                    `<p style="margin: 0; line-height: 1.7;">${(b.content || '').replace(/\n/g, '<br/>')}</p>` +
                    `</div>`
                );
                break;
            case 'button':
                parts.push(
                    `<div style="padding: 8px 24px 20px; background: #ffffff; text-align: center;">` +
                    `<a href="${b.url || '#'}" style="background: {{primary_color}}; color: #ffffff; padding: 12px 28px; border-radius: 6px; text-decoration: none; display: inline-block; font-weight: 600; font-size: 15px;">${b.label || 'Clicca qui'}</a>` +
                    `</div>`
                );
                break;
            case 'image':
                parts.push(
                    `<div style="padding: 16px 24px; background: #ffffff; text-align: center;">` +
                    `<img src="${b.src || ''}" alt="${b.alt || ''}" style="max-width: 100%; border-radius: 8px;" />` +
                    `</div>`
                );
                break;
            case 'logo': {
                const align = b.logoAlign || 'center';
                const width = b.logoWidth || 160;
                const bg = b.logoBg || '#ffffff';
                const src = b.logoSrc || '{{logo_url}}';
                parts.push(
                    `<div style="padding: 16px 24px; background: ${bg}; text-align: ${align};">` +
                    `<img src="${src}" alt="Logo" style="width: ${width}px; max-width: 100%; display: inline-block;" />` +
                    `</div>`
                );
                break;
            }
            case 'divider':
                parts.push(
                    `<div style="padding: 4px 24px; background: #ffffff;">` +
                    `<hr style="border: none; border-top: 1px solid #e5e7eb; margin: 8px 0;" />` +
                    `</div>`
                );
                break;
            case 'footer':
                parts.push(
                    `<div style="padding: 20px 24px; background: #f9fafb; color: #6b7280; font-size: 12px; text-align: center; border-top: 1px solid #e5e7eb;">` +
                    `{{footer_text}}<br/>` +
                    `<a href="{{unsubscribe_link}}" style="color: #9ca3af;">Annulla l'iscrizione</a>` +
                    `</div>`
                );
                break;
        }
    }
    parts.push(`</div>`);
    return parts.join('\n');
}

const DEFAULT_BLOCKS: Block[] = [
    { id: genId(), type: 'header', title: '{{brand_name}}' },
    { id: genId(), type: 'text', content: 'Ciao {{nome}},\n\nScrivi qui il contenuto della tua email...' },
    { id: genId(), type: 'button', label: 'Scopri di più', url: '#' },
    { id: genId(), type: 'footer' },
];

const BLOCK_DEFS: { type: BlockType; label: string; icon: React.ReactNode }[] = [
    { type: 'header', label: 'Intestazione', icon: <Type size={14} /> },
    { type: 'text', label: 'Testo', icon: <AlignLeft size={14} /> },
    { type: 'button', label: 'Pulsante', icon: <MousePointer size={14} /> },
    { type: 'image', label: 'Immagine', icon: <ImageIcon size={14} /> },
    { type: 'logo', label: 'Logo', icon: <Upload size={14} /> },
    { type: 'divider', label: 'Divisore', icon: <Minus size={14} /> },
    { type: 'footer', label: 'Footer', icon: <AlignLeft size={14} /> },
];

const PREVIEW_VARS = {
    nome: 'Mario Rossi',
    brand_name: 'Il tuo Brand',
    primary_color: '#2563eb',
    secondary_color: '#1e293b',
    logo_url: '',
    footer_text: 'Azienda S.r.l. — Via Roma 1, Milano',
    unsubscribe_link: '#',
};

// ─── Props ───────────────────────────────────────────────────────────────────

interface Props {
    template: MailTemplate | null;
    clientId: string;
    branding: MailBranding;
    onSaved: (t: MailTemplate) => void;
    onDeleted: (templateId: string) => void;
    onClose: () => void;
}

// ─── Block editor row ────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-1.5 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-lg text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50";
const labelCls = "block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1";

interface BlockRowProps {
    block: Block;
    index: number;
    total: number;
    selected: boolean;
    clientId: string;
    onSelect: () => void;
    onChange: (b: Block) => void;
    onMove: (dir: -1 | 1) => void;
    onDelete: () => void;
}

const BlockRow: React.FC<BlockRowProps> = ({ block, index, total, selected, clientId, onSelect, onChange, onMove, onDelete }) => {
    const [isUploading, setIsUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const logoInputRef = useRef<HTMLInputElement>(null);

    const handleLogoUpload = async (file: File) => {
        setIsUploading(true);
        setUploadError('');
        try {
            const url = await uploadMailLogo(clientId, file);
            onChange({ ...block, logoSrc: url });
        } catch (e: any) {
            setUploadError(e.message || 'Errore upload');
        } finally {
            setIsUploading(false);
        }
    };
    const def = BLOCK_DEFS.find(d => d.type === block.type)!;
    return (
        <div
            className={`rounded-xl border transition-all duration-150 overflow-hidden ${selected
                ? 'border-primary-400 dark:border-primary-500 shadow-sm'
                : 'border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
        >
            {/* Header row */}
            <div
                className={`flex items-center gap-2 px-3 py-2 cursor-pointer ${selected ? 'bg-primary-50 dark:bg-primary-900/20' : 'bg-white dark:bg-slate-800'}`}
                onClick={onSelect}
            >
                <span className="text-slate-400 dark:text-slate-500 shrink-0">{def.icon}</span>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 flex-1">{def.label}</span>
                <div className="flex items-center gap-0.5 ml-auto" onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => onMove(-1)} disabled={index === 0}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 transition-colors">
                        <ChevronUp size={13} />
                    </button>
                    <button type="button" onClick={() => onMove(1)} disabled={index === total - 1}
                        className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 disabled:opacity-20 transition-colors">
                        <ChevronDown size={13} />
                    </button>
                    <button type="button" onClick={onDelete}
                        className="p-1 rounded text-slate-400 hover:text-red-500 transition-colors ml-1">
                        <Trash2 size={13} />
                    </button>
                </div>
            </div>

            {/* Edit fields */}
            {selected && (
                <div className="px-3 pb-3 pt-1 bg-white dark:bg-slate-800/80 border-t border-slate-100 dark:border-slate-700/60 space-y-2">
                    {block.type === 'header' && (
                        <>
                            {/* Toggle testo / logo */}
                            <div>
                                <label className={labelCls}>Contenuto intestazione</label>
                                <div className="flex gap-1.5 mb-2">
                                    <button type="button"
                                        onClick={() => onChange({ ...block, logoSrc: undefined })}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${!block.logoSrc ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'}`}>
                                        Testo
                                    </button>
                                    <button type="button"
                                        onClick={() => { onChange({ ...block, title: undefined }); if (!block.logoSrc) setTimeout(() => logoInputRef.current?.click(), 50); }}
                                        className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${block.logoSrc ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'}`}>
                                        Logo
                                    </button>
                                </div>
                            </div>

                            {!block.logoSrc ? (
                                <div>
                                    <label className={labelCls}>Titolo</label>
                                    <input className={inputCls} value={block.title || ''} placeholder="Titolo intestazione"
                                        onChange={e => onChange({ ...block, title: e.target.value })} />
                                </div>
                            ) : (
                                <>
                                    {/* Logo upload nell'header */}
                                    <div>
                                        <input ref={logoInputRef} type="file" accept="image/*" className="hidden"
                                            onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }} />
                                        <div className="flex items-center gap-2">
                                            <img src={block.logoSrc} alt="Logo" className="h-10 w-auto rounded border border-slate-200 dark:border-slate-600 object-contain bg-white" />
                                            <button type="button" onClick={() => logoInputRef.current?.click()} disabled={isUploading}
                                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50">
                                                {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                                {isUploading ? 'Caricamento...' : 'Cambia logo'}
                                            </button>
                                        </div>
                                        {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                                    </div>
                                    <div>
                                        <label className={labelCls}>Posizione</label>
                                        <div className="flex gap-1.5">
                                            {(['left', 'center', 'right'] as LogoAlign[]).map(a => (
                                                <button key={a} type="button"
                                                    onClick={() => onChange({ ...block, logoAlign: a })}
                                                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${(block.logoAlign || 'center') === a ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'}`}>
                                                    {a === 'left' ? 'Sinistra' : a === 'center' ? 'Centro' : 'Destra'}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    <div>
                                        <label className={labelCls}>Larghezza — {block.logoWidth || 160}px</label>
                                        <input type="range" min={60} max={400} step={10}
                                            value={block.logoWidth || 160}
                                            onChange={e => onChange({ ...block, logoWidth: Number(e.target.value) })}
                                            className="w-full accent-primary-600" />
                                    </div>
                                </>
                            )}

                            {/* Posizione testo (solo se testo) */}
                            {!block.logoSrc && (
                                <div>
                                    <label className={labelCls}>Allineamento</label>
                                    <div className="flex gap-1.5">
                                        {(['left', 'center', 'right'] as LogoAlign[]).map(a => (
                                            <button key={a} type="button"
                                                onClick={() => onChange({ ...block, logoAlign: a })}
                                                className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ${(block.logoAlign || 'center') === a ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'}`}>
                                                {a === 'left' ? 'Sinistra' : a === 'center' ? 'Centro' : 'Destra'}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                    {block.type === 'text' && (
                        <div>
                            <label className={labelCls}>Contenuto</label>
                            <textarea className={inputCls} rows={4} value={block.content || ''}
                                placeholder="Scrivi il testo..."
                                onChange={e => onChange({ ...block, content: e.target.value })} />
                            <p className="text-xs text-slate-400 mt-0.5">Puoi usare <code className="text-xs bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{{nome}}`}</code> per il nome della lead.</p>
                        </div>
                    )}
                    {block.type === 'button' && (
                        <>
                            <div>
                                <label className={labelCls}>Testo del pulsante</label>
                                <input className={inputCls} value={block.label || ''} placeholder="Scopri di più"
                                    onChange={e => onChange({ ...block, label: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>URL di destinazione</label>
                                <input className={inputCls} value={block.url || ''} placeholder="https://tuosito.it/pagina"
                                    onChange={e => onChange({ ...block, url: e.target.value })} />
                            </div>
                        </>
                    )}
                    {block.type === 'image' && (
                        <>
                            <div>
                                <label className={labelCls}>URL immagine</label>
                                <input className={inputCls} value={block.src || ''} placeholder="https://..."
                                    onChange={e => onChange({ ...block, src: e.target.value })} />
                            </div>
                            <div>
                                <label className={labelCls}>Testo alternativo</label>
                                <input className={inputCls} value={block.alt || ''} placeholder="Descrizione immagine"
                                    onChange={e => onChange({ ...block, alt: e.target.value })} />
                            </div>
                        </>
                    )}
                    {block.type === 'logo' && (
                        <>
                            {/* Upload */}
                            <div>
                                <label className={labelCls}>Logo</label>
                                <input
                                    ref={logoInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoUpload(f); e.target.value = ''; }}
                                />
                                <div className="flex items-center gap-2">
                                    {block.logoSrc && (
                                        <img src={block.logoSrc} alt="Logo" className="h-10 w-auto rounded border border-slate-200 dark:border-slate-600 object-contain bg-white" />
                                    )}
                                    <button type="button" onClick={() => logoInputRef.current?.click()} disabled={isUploading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-xs font-medium text-slate-600 dark:text-slate-300 hover:border-primary-400 hover:text-primary-600 transition-colors disabled:opacity-50">
                                        {isUploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                                        {isUploading ? 'Caricamento...' : block.logoSrc ? 'Cambia logo' : 'Carica logo'}
                                    </button>
                                </div>
                                {uploadError && <p className="text-xs text-red-500 mt-1">{uploadError}</p>}
                                <p className="text-xs text-slate-400 mt-1">JPG, PNG, SVG, WebP — compresso automaticamente</p>
                            </div>

                            {/* Posizione */}
                            <div>
                                <label className={labelCls}>Posizione</label>
                                <div className="flex gap-1.5">
                                    {(['left', 'center', 'right'] as LogoAlign[]).map(a => (
                                        <button key={a} type="button"
                                            onClick={() => onChange({ ...block, logoAlign: a })}
                                            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${(block.logoAlign || 'center') === a ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-400 text-primary-700 dark:text-primary-400' : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'}`}>
                                            {a === 'left' ? 'Sinistra' : a === 'center' ? 'Centro' : 'Destra'}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Dimensione */}
                            <div>
                                <label className={labelCls}>Larghezza — {block.logoWidth || 160}px</label>
                                <input type="range" min={60} max={400} step={10}
                                    value={block.logoWidth || 160}
                                    onChange={e => onChange({ ...block, logoWidth: Number(e.target.value) })}
                                    className="w-full accent-primary-600" />
                                <div className="flex justify-between text-[10px] text-slate-400 mt-0.5">
                                    <span>60px</span><span>400px</span>
                                </div>
                            </div>

                            {/* Colore sfondo */}
                            <div>
                                <label className={labelCls}>Colore sfondo</label>
                                <div className="flex items-center gap-2">
                                    <input type="color" value={block.logoBg || '#ffffff'}
                                        onChange={e => onChange({ ...block, logoBg: e.target.value })}
                                        className="w-8 h-8 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5 bg-white dark:bg-slate-800" />
                                    <input className={inputCls} value={block.logoBg || '#ffffff'}
                                        onChange={e => onChange({ ...block, logoBg: e.target.value })}
                                        placeholder="#ffffff" style={{ maxWidth: 120 }} />
                                    <button type="button" onClick={() => onChange({ ...block, logoBg: 'transparent' })}
                                        className="text-xs text-slate-400 hover:text-slate-600 underline">
                                        Trasparente
                                    </button>
                                </div>
                            </div>
                        </>
                    )}
                    {(block.type === 'divider' || block.type === 'footer') && (
                        <p className="text-xs text-slate-400 italic">Questo blocco non ha opzioni aggiuntive.</p>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

const MailTemplateEditor: React.FC<Props> = ({ template, clientId, branding, onSaved, onDeleted, onClose }) => {
    const [name, setName] = useState('');
    const [subject, setSubject] = useState('');
    const [mode, setMode] = useState<'visual' | 'html'>('visual');
    const [blocks, setBlocks] = useState<Block[]>(DEFAULT_BLOCKS.map(b => ({ ...b, id: genId() })));
    const [htmlBody, setHtmlBody] = useState('');
    const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);
    const [error, setError] = useState('');
    const [saved, setSaved] = useState(false);
    const iframeRef = useRef<HTMLIFrameElement>(null);

    // Load template on open
    useEffect(() => {
        if (template) {
            setName(template.name);
            setSubject(template.subject_template);
            const body = template.body_html || '';
            setHtmlBody(body);
            // Try to parse as blocks — if not parseable, default to html mode
            // For simplicity: if template has body_html, start in html mode
            setMode('html');
            setBlocks(DEFAULT_BLOCKS.map(b => ({ ...b, id: genId() })));
        } else {
            setName('');
            setSubject('Una novità da {{brand_name}}');
            setBlocks(DEFAULT_BLOCKS.map(b => ({ ...b, id: genId() })));
            setHtmlBody(blocksToHtml(DEFAULT_BLOCKS));
            setMode('visual');
        }
        setError('');
        setSaved(false);
        setSelectedBlockId(null);
    }, [template]);

    // Sync blocks → htmlBody when in visual mode
    useEffect(() => {
        if (mode === 'visual') {
            setHtmlBody(blocksToHtml(blocks));
        }
    }, [blocks, mode]);

    // Build preview vars merging branding
    const previewVars = {
        ...PREVIEW_VARS,
        brand_name: branding.brand_name || 'Il tuo Brand',
        primary_color: branding.primary_color || '#2563eb',
        secondary_color: branding.secondary_color || '#1e293b',
        logo_url: branding.logo_url || '',
        footer_text: branding.footer_text || 'La tua azienda',
    };

    const previewHtml = renderPreview(htmlBody, previewVars);

    // Update iframe
    useEffect(() => {
        const iframe = iframeRef.current;
        if (!iframe) return;
        const doc = iframe.contentDocument || iframe.contentWindow?.document;
        if (!doc) return;
        doc.open();
        doc.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;background:#f1f5f9}*{box-sizing:border-box}</style></head><body>${previewHtml}</body></html>`);
        doc.close();
    }, [previewHtml]);

    const addBlock = (type: BlockType) => {
        const newBlock: Block = { id: genId(), type };
        if (type === 'header') newBlock.title = '{{brand_name}}';
        if (type === 'text') newBlock.content = 'Inserisci il testo qui...';
        if (type === 'button') { newBlock.label = 'Clicca qui'; newBlock.url = '#'; }
        // Insert before footer if present
        setBlocks(prev => {
            const footerIdx = prev.findLastIndex(b => b.type === 'footer');
            if (footerIdx === -1) return [...prev, newBlock];
            return [...prev.slice(0, footerIdx), newBlock, ...prev.slice(footerIdx)];
        });
        setSelectedBlockId(newBlock.id);
    };

    const moveBlock = useCallback((id: string, dir: -1 | 1) => {
        setBlocks(prev => {
            const idx = prev.findIndex(b => b.id === id);
            if (idx === -1) return prev;
            const next = idx + dir;
            if (next < 0 || next >= prev.length) return prev;
            const arr = [...prev];
            [arr[idx], arr[next]] = [arr[next], arr[idx]];
            return arr;
        });
    }, []);

    const handleDelete = async () => {
        if (!template) return;
        setIsDeleting(true);
        setError('');
        try {
            await ApiService.deleteMailTemplate(template.id);
            onDeleted(template.id);
            onClose();
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'eliminazione.');
            setDeleteConfirm(false);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) { setError('Inserisci un nome per il template.'); return; }
        if (!subject.trim()) { setError('Inserisci l\'oggetto del template.'); return; }
        setIsSaving(true);
        setError('');
        try {
            const body = mode === 'visual' ? blocksToHtml(blocks) : htmlBody;
            const saved = await ApiService.saveMailTemplate({
                ...(template ? { id: template.id } : {}),
                client_id: clientId,
                name: name.trim(),
                layout: 'simple',
                subject_template: subject.trim(),
                body_html: body,
            });
            onSaved(saved);
            setSaved(true);
            setTimeout(() => { setSaved(false); onClose(); }, 800);
        } catch (err: any) {
            setError(err.message || 'Errore durante il salvataggio.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* ── Top bar ── */}
            <div className="h-14 shrink-0 flex items-center gap-3 px-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-700/60">
                <button type="button" onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={18} />
                </button>

                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />

                <input
                    type="text"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    placeholder="Nome template..."
                    className="flex-1 max-w-xs bg-transparent text-sm font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none"
                />

                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700 hidden sm:block" />

                {/* Mode toggle */}
                <div className="hidden sm:flex items-center gap-1 bg-slate-100 dark:bg-slate-700/60 rounded-lg p-0.5">
                    <button type="button"
                        onClick={() => { if (mode !== 'visual') { setHtmlBody(htmlBody); setMode('visual'); } }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'visual' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                        <LayoutGrid size={13} /> Blocchi
                    </button>
                    <button type="button"
                        onClick={() => { if (mode !== 'html') setMode('html'); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${mode === 'html' ? 'bg-white dark:bg-slate-600 text-slate-800 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700'}`}>
                        <Code size={13} /> HTML
                    </button>
                </div>

                <div className="ml-auto flex items-center gap-2">
                    {error && <span className="text-xs text-red-500 hidden sm:block">{error}</span>}

                    {/* Delete — solo su template esistente */}
                    {template && (
                        deleteConfirm ? (
                            <div className="flex items-center gap-1.5">
                                <span className="text-xs text-slate-500 hidden sm:block">Eliminare?</span>
                                <button type="button" onClick={handleDelete} disabled={isDeleting}
                                    className="flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                                    {isDeleting ? <Loader2 size={12} className="animate-spin" /> : null}
                                    Sì, elimina
                                </button>
                                <button type="button" onClick={() => setDeleteConfirm(false)}
                                    className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                                    No
                                </button>
                            </div>
                        ) : (
                            <button type="button" onClick={() => setDeleteConfirm(true)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold rounded-lg transition-colors">
                                <Trash2 size={13} /> Elimina
                            </button>
                        )
                    )}

                    <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

                    <button type="button" onClick={onClose}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Annulla
                    </button>
                    <button type="button" onClick={handleSave} disabled={isSaving}
                        className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                        {isSaving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
                        {saved ? 'Salvato!' : 'Salva'}
                    </button>
                </div>
            </div>

            {/* ── Subject bar ── */}
            <div className="shrink-0 flex items-center gap-3 px-4 py-2 bg-white/70 dark:bg-slate-800/70 backdrop-blur-sm border-b border-slate-200/50 dark:border-slate-700/50">
                <span className="text-xs font-medium text-slate-400 dark:text-slate-500 shrink-0">Oggetto:</span>
                <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Oggetto della mail, es: Una novità da {{brand_name}}"
                    className="flex-1 bg-transparent text-sm text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:outline-none"
                />
            </div>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">
                {mode === 'visual' ? (
                    <>
                        {/* Left: block palette + block list */}
                        <div className="w-72 shrink-0 flex flex-col bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-r border-slate-200/60 dark:border-slate-700/60 overflow-hidden">
                            {/* Add block palette */}
                            <div className="p-3 border-b border-slate-200/60 dark:border-slate-700/60">
                                <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Aggiungi blocco</p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {BLOCK_DEFS.map(def => (
                                        <button key={def.type} type="button" onClick={() => addBlock(def.type)}
                                            className="flex flex-col items-center gap-1 p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-500 dark:text-slate-400 hover:text-primary-600 dark:hover:text-primary-400 transition-all group">
                                            {def.icon}
                                            <span className="text-[10px] font-medium leading-none">{def.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            {/* Block list */}
                            <div className="flex-1 overflow-y-auto p-3 space-y-2">
                                {blocks.map((block, idx) => (
                                    <BlockRow
                                        key={block.id}
                                        block={block}
                                        index={idx}
                                        total={blocks.length}
                                        selected={selectedBlockId === block.id}
                                        clientId={clientId}
                                        onSelect={() => setSelectedBlockId(selectedBlockId === block.id ? null : block.id)}
                                        onChange={updated => setBlocks(prev => prev.map(b => b.id === updated.id ? updated : b))}
                                        onMove={dir => moveBlock(block.id, dir)}
                                        onDelete={() => {
                                            setBlocks(prev => prev.filter(b => b.id !== block.id));
                                            if (selectedBlockId === block.id) setSelectedBlockId(null);
                                        }}
                                    />
                                ))}
                            </div>
                        </div>
                        {/* Right: preview */}
                        <div className="flex-1 overflow-hidden bg-slate-100 dark:bg-slate-900/60">
                            <iframe
                                ref={iframeRef}
                                title="Anteprima email"
                                className="w-full h-full border-none"
                                sandbox="allow-same-origin"
                            />
                        </div>
                    </>
                ) : (
                    <>
                        {/* Left: HTML editor */}
                        <div className="w-1/2 flex flex-col border-r border-slate-200/60 dark:border-slate-700/60 bg-white/80 dark:bg-slate-800/80">
                            <div className="px-4 py-2 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2">
                                <Code size={13} className="text-slate-400" />
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">HTML</span>
                                <span className="ml-auto text-xs text-slate-400">Puoi usare <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{{nome}}`}</code>, <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">{`{{brand_name}}`}</code>, ecc.</span>
                            </div>
                            <textarea
                                value={htmlBody}
                                onChange={e => setHtmlBody(e.target.value)}
                                className="flex-1 w-full resize-none px-4 py-3 font-mono text-xs text-slate-800 dark:text-slate-100 bg-transparent focus:outline-none leading-relaxed"
                                spellCheck={false}
                                placeholder="Scrivi o incolla il tuo HTML..."
                            />
                        </div>
                        {/* Right: preview */}
                        <div className="w-1/2 overflow-hidden bg-slate-100 dark:bg-slate-900/60 flex flex-col">
                            <div className="px-4 py-2 border-b border-slate-200/50 dark:border-slate-700/50 flex items-center gap-2 bg-white/70 dark:bg-slate-800/70">
                                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Anteprima</span>
                            </div>
                            <div className="flex-1">
                                <iframe
                                    ref={iframeRef}
                                    title="Anteprima email"
                                    className="w-full h-full border-none"
                                    sandbox="allow-same-origin"
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Error bar */}
            {error && (
                <div className="shrink-0 px-4 py-2 bg-red-50 dark:bg-red-900/20 border-t border-red-200 dark:border-red-800/50 text-xs text-red-600 dark:text-red-400">
                    {error}
                </div>
            )}
        </div>
    );
};

export default MailTemplateEditor;
