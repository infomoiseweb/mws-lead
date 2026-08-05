import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    Zap, Filter, Clock, Mail, Plus, Trash2, Save, Loader2, Play,
    ChevronDown, Check, X, Settings, ToggleLeft, ToggleRight
} from 'lucide-react';
import type { MailTemplate, Client } from '../../types';

// ─── Types ───────────────────────────────────────────────────────────────────

export type NodeType = 'trigger' | 'filter' | 'delay' | 'send_email';

export interface FlowNode {
    id: string;
    type: NodeType;
    x: number;
    y: number;
    config: Record<string, any>;
}

export interface FlowEdge {
    id: string;
    source: string;
    target: string;
}

export interface FlowData {
    nodes: FlowNode[];
    edges: FlowEdge[];
}

export interface MailFlow {
    id: string;
    client_id: string;
    name: string;
    active: boolean;
    flow_data: FlowData;
    created_at: string;
    updated_at: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const NODE_W = 190;
const NODE_H = 88;
const CANVAS_H = 480;
const NODE_Y = CANVAS_H / 2 - NODE_H / 2;
const INITIAL_X = 80;
const NODE_SPACING = 290;

function genId() { return Math.random().toString(36).slice(2, 9); }

const NODE_DEFS: Record<NodeType, { label: string; color: string; border: string; bg: string; darkBg: string; icon: React.ReactNode }> = {
    trigger: {
        label: 'Trigger',
        color: '#16a34a',
        border: '#86efac',
        bg: '#f0fdf4',
        darkBg: 'rgba(20,83,45,0.35)',
        icon: <Zap size={16} />,
    },
    filter: {
        label: 'Filtro',
        color: '#2563eb',
        border: '#93c5fd',
        bg: '#eff6ff',
        darkBg: 'rgba(30,58,138,0.35)',
        icon: <Filter size={16} />,
    },
    delay: {
        label: 'Attesa',
        color: '#d97706',
        border: '#fcd34d',
        bg: '#fffbeb',
        darkBg: 'rgba(120,53,15,0.35)',
        icon: <Clock size={16} />,
    },
    send_email: {
        label: 'Invia Email',
        color: '#9333ea',
        border: '#d8b4fe',
        bg: '#fdf4ff',
        darkBg: 'rgba(88,28,135,0.35)',
        icon: <Mail size={16} />,
    },
};

const PALETTE_NODES: { type: NodeType; desc: string }[] = [
    { type: 'trigger', desc: 'Avvia il flusso' },
    { type: 'filter', desc: 'Condizione sui dati lead' },
    { type: 'delay', desc: 'Aspetta X ore/giorni' },
    { type: 'send_email', desc: 'Invia un template email' },
];

// ─── Node summary text ────────────────────────────────────────────────────────

function nodeSummary(node: FlowNode, templates: MailTemplate[]): string {
    const { type, config } = node;
    if (type === 'trigger') {
        if (config.trigger_type === 'lead_created') return 'Nuova lead creata';
        if (config.trigger_type === 'status_changed') return `Stato → ${config.trigger_status || '?'}`;
        return 'Configura trigger…';
    }
    if (type === 'filter') {
        if (config.field && config.value) return `${config.field} = "${config.value}"`;
        return 'Configura filtro…';
    }
    if (type === 'delay') {
        if (config.amount) return `Aspetta ${config.amount} ${config.unit === 'days' ? 'giorni' : 'ore'}`;
        return 'Configura attesa…';
    }
    if (type === 'send_email') {
        const tpl = templates.find(t => t.id === config.template_id);
        return tpl ? `Template: ${tpl.name}` : 'Seleziona template…';
    }
    return '';
}

// ─── Config panel ─────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40";
const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1 uppercase tracking-wider";

const STATUS_OPTIONS = ['Nuovo', 'Contattato', 'In Lavorazione', 'Vinto', 'Perso', 'Preventivo Inviato', 'Preventivo Accettato', 'Preventivo Rifiutato'];

interface ConfigPanelProps {
    node: FlowNode;
    templates: MailTemplate[];
    client: Client;
    onChange: (config: Record<string, any>) => void;
    onDelete: () => void;
}

const ConfigPanel: React.FC<ConfigPanelProps> = ({ node, templates, client, onChange, onDelete }) => {
    const def = NODE_DEFS[node.type];
    const c = node.config;

    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200/60 dark:border-slate-700/60" style={{ borderLeftColor: def.color, borderLeftWidth: 3 }}>
                <span style={{ color: def.color }}>{def.icon}</span>
                <span className="font-bold text-sm text-slate-800 dark:text-white">{def.label}</span>
                <button type="button" onClick={onDelete}
                    className="ml-auto p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 size={14} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* TRIGGER */}
                {node.type === 'trigger' && (
                    <>
                        <div>
                            <label className={labelCls}>Evento</label>
                            <select value={c.trigger_type || ''} onChange={e => onChange({ ...c, trigger_type: e.target.value })} className={inputCls}>
                                <option value="">Seleziona…</option>
                                <option value="lead_created">Nuova lead creata</option>
                                <option value="status_changed">Stato lead cambiato</option>
                            </select>
                        </div>
                        {c.trigger_type === 'status_changed' && (
                            <div>
                                <label className={labelCls}>Quando lo stato diventa</label>
                                <select value={c.trigger_status || ''} onChange={e => onChange({ ...c, trigger_status: e.target.value })} className={inputCls}>
                                    <option value="">Seleziona stato…</option>
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                    </>
                )}

                {/* FILTER */}
                {node.type === 'filter' && (
                    <>
                        <div>
                            <label className={labelCls}>Campo</label>
                            <select value={c.field || ''} onChange={e => onChange({ ...c, field: e.target.value, value: '' })} className={inputCls}>
                                <option value="">Seleziona campo…</option>
                                <option value="service">Servizio</option>
                                <option value="status">Stato</option>
                            </select>
                        </div>
                        {c.field === 'service' && (
                            <div>
                                <label className={labelCls}>Servizio</label>
                                <select value={c.value || ''} onChange={e => onChange({ ...c, value: e.target.value })} className={inputCls}>
                                    <option value="">Tutti i servizi</option>
                                    {(client.services || []).map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                            </div>
                        )}
                        {c.field === 'status' && (
                            <div>
                                <label className={labelCls}>Stato</label>
                                <select value={c.value || ''} onChange={e => onChange({ ...c, value: e.target.value })} className={inputCls}>
                                    <option value="">Qualsiasi stato</option>
                                    {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                            </div>
                        )}
                        <p className="text-xs text-slate-400 dark:text-slate-500">Il flusso continua solo se la lead soddisfa questa condizione.</p>
                    </>
                )}

                {/* DELAY */}
                {node.type === 'delay' && (
                    <>
                        <div>
                            <label className={labelCls}>Durata</label>
                            <div className="flex gap-2">
                                <input type="number" min={1} max={999} value={c.amount || ''} onChange={e => onChange({ ...c, amount: parseInt(e.target.value) || 1 })}
                                    className={inputCls + ' w-24'} placeholder="1" />
                                <select value={c.unit || 'hours'} onChange={e => onChange({ ...c, unit: e.target.value })} className={inputCls}>
                                    <option value="hours">Ore</option>
                                    <option value="days">Giorni</option>
                                </select>
                            </div>
                        </div>
                        <p className="text-xs text-slate-400 dark:text-slate-500">
                            Il sistema aspetta {c.amount || '?'} {c.unit === 'days' ? 'giorni' : 'ore'} prima di continuare.
                        </p>
                    </>
                )}

                {/* SEND EMAIL */}
                {node.type === 'send_email' && (
                    <>
                        <div>
                            <label className={labelCls}>Template email</label>
                            {templates.length === 0 ? (
                                <p className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                                    Nessun template disponibile. Creane uno nella sezione Template.
                                </p>
                            ) : (
                                <select value={c.template_id || ''} onChange={e => onChange({ ...c, template_id: e.target.value })} className={inputCls}>
                                    <option value="">Seleziona template…</option>
                                    {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                </select>
                            )}
                        </div>
                        {c.template_id && (
                            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3">
                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                    Oggetto: <span className="text-slate-700 dark:text-slate-200 font-medium">{templates.find(t => t.id === c.template_id)?.subject_template}</span>
                                </p>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Node card ────────────────────────────────────────────────────────────────

interface NodeCardProps {
    node: FlowNode;
    selected: boolean;
    isDark: boolean;
    templates: MailTemplate[];
    onSelect: () => void;
    onDragStart: (e: React.MouseEvent) => void;
}

const NodeCard: React.FC<NodeCardProps> = ({ node, selected, isDark, templates, onSelect, onDragStart }) => {
    const def = NODE_DEFS[node.type];
    const summary = nodeSummary(node, templates);

    return (
        <div
            onMouseDown={onDragStart}
            onClick={onSelect}
            style={{
                position: 'absolute',
                left: node.x,
                top: node.y,
                width: NODE_W,
                height: NODE_H,
                background: isDark ? def.darkBg : def.bg,
                border: `2px solid ${selected ? def.color : def.border}`,
                borderRadius: 16,
                boxShadow: selected
                    ? `0 0 0 3px ${def.color}33, 0 4px 24px ${def.color}22`
                    : '0 2px 12px rgba(0,0,0,0.07)',
                cursor: 'grab',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                padding: '12px 16px',
                userSelect: 'none',
                transition: 'box-shadow 0.15s, border-color 0.15s',
                backdropFilter: 'blur(8px)',
            }}
        >
            {/* Input port */}
            {node.type !== 'trigger' && (
                <div style={{
                    position: 'absolute', left: -6, top: '50%', transform: 'translateY(-50%)',
                    width: 12, height: 12, borderRadius: '50%',
                    background: def.color, border: '2px solid white',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
                }} />
            )}
            {/* Output port */}
            <div style={{
                position: 'absolute', right: -6, top: '50%', transform: 'translateY(-50%)',
                width: 12, height: 12, borderRadius: '50%',
                background: def.color, border: '2px solid white',
                boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{
                    color: def.color,
                    background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.7)',
                    borderRadius: 8, padding: '4px 6px', display: 'flex',
                }}>
                    {def.icon}
                </span>
                <span style={{
                    fontSize: 12, fontWeight: 700, color: def.color,
                    textTransform: 'uppercase', letterSpacing: '0.08em',
                }}>
                    {def.label}
                </span>
            </div>
            <div style={{
                fontSize: 12,
                color: isDark ? 'rgba(255,255,255,0.75)' : '#374151',
                lineHeight: 1.4,
                fontWeight: 500,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
                {summary}
            </div>
        </div>
    );
};

// ─── SVG Connections ──────────────────────────────────────────────────────────

const Connections: React.FC<{ nodes: FlowNode[]; edges: FlowEdge[] }> = ({ nodes, edges }) => {
    const nodeMap = new Map<string, FlowNode>(nodes.map(n => [n.id, n]));
    return (
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', overflow: 'visible' }}>
            <defs>
                <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#94a3b8" />
                </marker>
            </defs>
            {edges.map(edge => {
                const src = nodeMap.get(edge.source);
                const dst = nodeMap.get(edge.target);
                if (!src || !dst) return null;
                const x1 = src.x + NODE_W;
                const y1 = src.y + NODE_H / 2;
                const x2 = dst.x;
                const y2 = dst.y + NODE_H / 2;
                const cp = Math.max((x2 - x1) * 0.5, 40);
                const d = `M ${x1} ${y1} C ${x1 + cp} ${y1} ${x2 - cp} ${y2} ${x2} ${y2}`;
                return (
                    <g key={edge.id}>
                        <path d={d} fill="none" stroke="#cbd5e1" strokeWidth={2.5} strokeDasharray="6 4" />
                        <path d={d} fill="none" stroke="#94a3b8" strokeWidth={2} markerEnd="url(#arrowhead)"
                            style={{ strokeDasharray: '6 4', strokeDashoffset: 0 }} />
                    </g>
                );
            })}
        </svg>
    );
};

// ─── Main component ───────────────────────────────────────────────────────────

export interface MailFlowBuilderProps {
    flow: MailFlow | null;
    templates: MailTemplate[];
    client: Client;
    isSaving: boolean;
    onSave: (name: string, active: boolean, flowData: FlowData) => Promise<void>;
    onDelete?: () => Promise<void>;
}

const MailFlowBuilder: React.FC<MailFlowBuilderProps> = ({ flow, templates, client, isSaving, onSave, onDelete }) => {
    const [name, setName] = useState(flow?.name || 'Nuovo flusso');
    const [active, setActive] = useState(flow?.active || false);
    const [nodes, setNodes] = useState<FlowNode[]>(flow?.flow_data?.nodes || []);
    const [edges, setEdges] = useState<FlowEdge[]>(flow?.flow_data?.edges || []);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    const canvasRef = useRef<HTMLDivElement>(null);
    const panRef = useRef({ x: 0, y: 0 });
    const [pan, setPan] = useState({ x: 0, y: 0 });

    // Detect dark mode
    const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
    useEffect(() => {
        const obs = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
        obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        return () => obs.disconnect();
    }, []);

    const selectedNode = nodes.find(n => n.id === selectedId) || null;

    // Add node to canvas
    const addNode = (type: NodeType) => {
        const lastNode = nodes[nodes.length - 1];
        const x = lastNode ? lastNode.x + NODE_SPACING : INITIAL_X;
        const y = NODE_Y;
        const newNode: FlowNode = { id: genId(), type, x, y, config: {} };

        // Auto-connect to previous node
        if (lastNode) {
            const newEdge: FlowEdge = { id: genId(), source: lastNode.id, target: newNode.id };
            setEdges(prev => [...prev, newEdge]);
        }
        setNodes(prev => [...prev, newNode]);
        setSelectedId(newNode.id);
    };

    // Delete selected node
    const deleteNode = (nodeId: string) => {
        setNodes(prev => prev.filter(n => n.id !== nodeId));
        setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
        if (selectedId === nodeId) setSelectedId(null);
    };

    // Update node config
    const updateNodeConfig = (nodeId: string, config: Record<string, any>) => {
        setNodes(prev => prev.map(n => n.id === nodeId ? { ...n, config } : n));
    };

    // Drag node
    const draggingRef = useRef<{ nodeId: string; startX: number; startY: number; nodeX: number; nodeY: number } | null>(null);

    const handleNodeMouseDown = useCallback((e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        const node = nodes.find(n => n.id === nodeId);
        if (!node) return;
        draggingRef.current = { nodeId, startX: e.clientX, startY: e.clientY, nodeX: node.x, nodeY: node.y };

        const onMove = (ev: MouseEvent) => {
            if (!draggingRef.current) return;
            const dx = ev.clientX - draggingRef.current.startX;
            const dy = ev.clientY - draggingRef.current.startY;
            setNodes(prev => prev.map(n =>
                n.id === draggingRef.current!.nodeId
                    ? { ...n, x: draggingRef.current!.nodeX + dx, y: draggingRef.current!.nodeY + dy }
                    : n
            ));
        };
        const onUp = () => {
            draggingRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    }, [nodes]);

    // Pan canvas
    const panStartRef = useRef<{ x: number; y: number; panX: number; panY: number } | null>(null);
    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (e.target !== canvasRef.current && !(e.target as HTMLElement).closest('[data-canvas-bg]')) return;
        setSelectedId(null);
        panStartRef.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
        const onMove = (ev: MouseEvent) => {
            if (!panStartRef.current) return;
            setPan({ x: panStartRef.current.panX + ev.clientX - panStartRef.current.x, y: panStartRef.current.panY + ev.clientY - panStartRef.current.y });
        };
        const onUp = () => {
            panStartRef.current = null;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const handleSave = async () => {
        await onSave(name, active, { nodes, edges });
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    // Canvas world width for scrolling
    const worldW = nodes.length > 0
        ? Math.max(...nodes.map(n => n.x + NODE_W)) + INITIAL_X + 100
        : 800;

    return (
        <div className="flex flex-col h-full">
            {/* ── Top bar ── */}
            <div className="flex items-center gap-3 px-4 py-3 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-700/60 shrink-0">
                <div className="flex flex-col min-w-0">
                    <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-0.5">Nome flusso</span>
                    <input
                        value={name}
                        onChange={e => setName(e.target.value)}
                        placeholder="Es. Benvenuto nuove lead…"
                        className="w-56 px-2.5 py-1 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-semibold text-slate-800 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400/40 focus:border-primary-400 transition-all"
                    />
                </div>

                {/* Active toggle */}
                <button type="button" onClick={() => setActive(v => !v)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        active
                            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                    }`}>
                    {active ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                    {active ? 'Attivo' : 'Inattivo'}
                </button>

                <div className="h-4 w-px bg-slate-200 dark:bg-slate-700" />

                {onDelete && (
                    deleteConfirm ? (
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-slate-500">Eliminare?</span>
                            <button type="button" onClick={async () => { await onDelete(); }}
                                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                Sì
                            </button>
                            <button type="button" onClick={() => setDeleteConfirm(false)}
                                className="px-2.5 py-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 text-xs font-semibold rounded-lg transition-colors">
                                No
                            </button>
                        </div>
                    ) : (
                        <button type="button" onClick={() => setDeleteConfirm(true)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold rounded-xl transition-colors">
                            <Trash2 size={13} /> Elimina
                        </button>
                    )
                )}

                <button type="button" onClick={handleSave} disabled={isSaving}
                    className="flex items-center gap-2 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors">
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : <Save size={13} />}
                    {saved ? 'Salvato!' : 'Salva flusso'}
                </button>
            </div>

            {/* ── Body ── */}
            <div className="flex flex-1 min-h-0">
                {/* Left: palette */}
                <div className="w-48 shrink-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-r border-slate-200/60 dark:border-slate-700/60 flex flex-col p-3 gap-2 overflow-y-auto">
                    <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-1 mb-1">Aggiungi nodo</p>
                    {PALETTE_NODES.map(({ type, desc }) => {
                        const def = NODE_DEFS[type];
                        return (
                            <button key={type} type="button" onClick={() => addNode(type)}
                                className="flex items-start gap-2.5 p-2.5 rounded-xl border transition-all text-left hover:scale-[1.02] active:scale-95"
                                style={{
                                    background: isDark ? def.darkBg : def.bg,
                                    borderColor: def.border,
                                }}>
                                <span style={{ color: def.color, marginTop: 1 }}>{def.icon}</span>
                                <div>
                                    <div className="text-xs font-bold" style={{ color: def.color }}>{def.label}</div>
                                    <div className="text-[10px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">{desc}</div>
                                </div>
                            </button>
                        );
                    })}

                    <div className="mt-auto pt-3 border-t border-slate-200/60 dark:border-slate-700/60">
                        <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
                            Trascina i nodi sul canvas per riposizionarli. Clicca un nodo per configurarlo.
                        </p>
                    </div>
                </div>

                {/* Center: canvas */}
                <div
                    ref={canvasRef}
                    onMouseDown={handleCanvasMouseDown}
                    className="flex-1 relative overflow-hidden"
                    style={{
                        background: isDark
                            ? 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.04) 1px, transparent 1px)'
                            : 'radial-gradient(circle at 1px 1px, rgba(0,0,0,0.05) 1px, transparent 1px)',
                        backgroundSize: '32px 32px',
                        backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                        cursor: 'default',
                    }}
                >
                    <div data-canvas-bg="1" style={{ position: 'absolute', inset: 0 }} />

                    {nodes.length === 0 && (
                        <div style={{
                            position: 'absolute', inset: 0,
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                            pointerEvents: 'none',
                        }}>
                            <div style={{
                                background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.85)',
                                border: `1.5px dashed ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                                borderRadius: 20, padding: '32px 48px', textAlign: 'center',
                            }}>
                                <Zap size={32} style={{ color: '#94a3b8', margin: '0 auto 12px' }} />
                                <p style={{ fontSize: 14, fontWeight: 700, color: isDark ? '#cbd5e1' : '#475569', margin: '0 0 4px' }}>
                                    Canvas vuota
                                </p>
                                <p style={{ fontSize: 12, color: '#94a3b8', margin: 0 }}>
                                    Aggiungi un nodo dalla palette a sinistra per iniziare
                                </p>
                            </div>
                        </div>
                    )}

                    {/* World with pan */}
                    <div style={{ position: 'absolute', inset: 0, transform: `translate(${pan.x}px, ${pan.y}px)` }}>
                        <Connections nodes={nodes} edges={edges} />
                        {nodes.map(node => (
                            <NodeCard
                                key={node.id}
                                node={node}
                                selected={selectedId === node.id}
                                isDark={isDark}
                                templates={templates}
                                onSelect={() => setSelectedId(node.id)}
                                onDragStart={e => handleNodeMouseDown(e, node.id)}
                            />
                        ))}
                    </div>
                </div>

                {/* Right: config panel */}
                <div className={`w-64 shrink-0 bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm border-l border-slate-200/60 dark:border-slate-700/60 flex flex-col transition-all ${selectedNode ? 'translate-x-0' : 'translate-x-full'}`}
                    style={{ display: selectedNode ? 'flex' : 'none' }}>
                    {selectedNode && (
                        <ConfigPanel
                            node={selectedNode}
                            templates={templates}
                            client={client}
                            onChange={config => updateNodeConfig(selectedNode.id, config)}
                            onDelete={() => deleteNode(selectedNode.id)}
                        />
                    )}
                </div>
            </div>
        </div>
    );
};

export default MailFlowBuilder;
