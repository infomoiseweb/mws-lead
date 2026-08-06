import React, { useEffect, useState, useMemo } from 'react';
import * as ApiService from '@api';
import { supabase } from '../../lib/supabase';
import type { Client, MailCampaign, MailTemplate, Lead } from '../../types';
import {
    X, Loader2, Send, Clock, Calendar, Zap, Search, Check,
    Users, ChevronDown, ChevronUp, AlertCircle
} from 'lucide-react';

type ScheduleMode = 'now' | 'scheduled';

const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors";
const labelCls = "block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1";

const LEAD_STATUSES: Lead['status'][] = [
    'Nuovo', 'Contattato', 'In Lavorazione',
    'Preventivo Inviato', 'Preventivo Accettato', 'Preventivo Rifiutato',
    'Vinto', 'Perso', 'A Rate',
];

const STATUS_COLORS: Record<string, string> = {
    'Nuovo': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    'Contattato': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',
    'In Lavorazione': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    'Preventivo Inviato': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
    'Preventivo Accettato': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
    'Preventivo Rifiutato': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
    'Vinto': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    'Perso': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
    'A Rate': 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
};

interface Props {
    isOpen: boolean;
    onClose: () => void;
    campaign: MailCampaign | null;
    client: Client;
    templates: MailTemplate[];
    canSend: boolean;
    onSaved: (campaign: MailCampaign) => void;
}

const MailCampaignModal: React.FC<Props> = ({ isOpen, onClose, campaign, client, templates, canSend, onSaved }) => {
    // ── Form state ───────────────────────────────────────────────────────────
    const [name, setName] = useState('');
    const [templateId, setTemplateId] = useState('');
    const [subject, setSubject] = useState('');
    const [scheduleMode, setScheduleMode] = useState<ScheduleMode>('now');
    const [scheduledAt, setScheduledAt] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    // ── Filters ──────────────────────────────────────────────────────────────
    const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
    const [filterServices, setFilterServices] = useState<string[]>([]);
    const [filterSearch, setFilterSearch] = useState('');

    // ── Leads ────────────────────────────────────────────────────────────────
    const [allLeads, setAllLeads] = useState<Lead[]>([]);
    const [isLoadingLeads, setIsLoadingLeads] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [showFilters, setShowFilters] = useState(true);

    const availableServices = useMemo(() =>
        (client.services || [])
            .filter(s => s.name !== '__default_fields__' && s.name !== '__lead_mode__')
            .map(s => s.name),
        [client.services]
    );

    // ── Load leads ───────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        const fetchLeads = async () => {
            setIsLoadingLeads(true);
            try {
                const { data, error } = await supabase
                    .from('leads')
                    .select('id, created_at, data, status, service, value')
                    .eq('client_id', client.id)
                    .order('created_at', { ascending: false });
                if (!error) setAllLeads((data || []) as Lead[]);
            } finally {
                setIsLoadingLeads(false);
            }
        };
        fetchLeads();
    }, [isOpen, client.id]);

    // ── Init form ────────────────────────────────────────────────────────────
    useEffect(() => {
        if (!isOpen) return;
        setError(''); setSuccessMsg('');
        if (campaign) {
            setName(campaign.name);
            setTemplateId(campaign.template_id || '');
            setSubject(campaign.subject);
            setFilterStatuses(campaign.filters?.statuses || []);
            setFilterServices(campaign.filters?.services || []);
            setSelectedIds(new Set(campaign.filters?.lead_ids || []));
        } else {
            const first = templates[0];
            setName(''); setTemplateId(first?.id || ''); setSubject(first?.subject_template || '');
            setFilterStatuses([]); setFilterServices([]); setFilterSearch('');
            setSelectedIds(new Set()); setScheduleMode('now'); setScheduledAt('');
        }
    }, [isOpen, campaign, templates]);

    // ── Filtered leads ───────────────────────────────────────────────────────
    const filteredLeads = useMemo(() => {
        const q = filterSearch.toLowerCase().trim();
        return allLeads.filter(lead => {
            if (filterStatuses.length > 0 && !filterStatuses.includes(lead.status)) return false;
            if (filterServices.length > 0 && !filterServices.includes(lead.service || '')) return false;
            if (q) {
                const haystack = [
                    lead.data?.nome, lead.data?.name, lead.data?.email,
                    lead.data?.telefono, lead.data?.phone, lead.service,
                    ...Object.values(lead.data || {}),
                ].join(' ').toLowerCase();
                if (!haystack.includes(q)) return false;
            }
            return true;
        });
    }, [allLeads, filterStatuses, filterServices, filterSearch]);

    const allFilteredSelected = filteredLeads.length > 0 && filteredLeads.every(l => selectedIds.has(l.id));

    const toggleLead = (id: string) => {
        setSelectedIds(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    };

    const toggleAll = () => {
        if (allFilteredSelected) {
            setSelectedIds(prev => { const n = new Set(prev); filteredLeads.forEach(l => n.delete(l.id)); return n; });
        } else {
            setSelectedIds(prev => { const n = new Set(prev); filteredLeads.forEach(l => n.add(l.id)); return n; });
        }
    };

    const toggleStatus = (s: string) =>
        setFilterStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
    const toggleService = (s: string) =>
        setFilterServices(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

    // ── Save / Send ──────────────────────────────────────────────────────────
    const buildFilters = () => ({
        ...(filterStatuses.length > 0 ? { statuses: filterStatuses } : {}),
        ...(filterServices.length > 0 ? { services: filterServices } : {}),
        ...(selectedIds.size > 0 ? { lead_ids: [...selectedIds] } : {}),
    });

    const persist = async (overrides?: Record<string, any>): Promise<MailCampaign> =>
        ApiService.saveMailCampaign({
            ...(campaign ? { id: campaign.id } : {}),
            client_id: client.id,
            name: name.trim(),
            template_id: templateId || null,
            subject,
            filters: buildFilters(),
            ...overrides,
        });

    const handleSaveDraft = async () => {
        if (!name.trim()) { setError('Inserisci un nome per la campagna.'); return; }
        setIsSaving(true); setError('');
        try { onSaved(await persist()); onClose(); }
        catch (e: any) { setError(e.message || 'Errore salvataggio.'); }
        finally { setIsSaving(false); }
    };

    const handleSchedule = async () => {
        if (!name.trim()) { setError('Inserisci un nome per la campagna.'); return; }
        if (!templateId) { setError('Seleziona un template.'); return; }
        if (!scheduledAt) { setError('Seleziona una data e ora di invio.'); return; }
        setIsSaving(true); setError('');
        try {
            const saved = await persist({ status: 'scheduled', scheduled_at: new Date(scheduledAt).toISOString() });
            onSaved(saved);
            setSuccessMsg('Campagna pianificata!');
            setTimeout(() => onClose(), 1200);
        } catch (e: any) { setError(e.message || 'Errore pianificazione.'); }
        finally { setIsSaving(false); }
    };

    const handleSendNow = async () => {
        if (!name.trim()) { setError('Inserisci un nome per la campagna.'); return; }
        if (!templateId) { setError('Seleziona un template.'); return; }
        setIsSending(true); setError(''); setSuccessMsg('');
        try {
            const saved = await persist();
            const sent = await ApiService.sendMailCampaign(saved.id);
            onSaved(sent);
            setSuccessMsg('Campagna inviata!');
            setTimeout(() => onClose(), 1200);
        } catch (e: any) { setError(e.message || 'Errore invio.'); }
        finally { setIsSending(false); }
    };

    if (!isOpen) return null;

    const leadName = (l: Lead) =>
        l.data?.nome || l.data?.name || l.data?.Name || l.data?.cognome || '—';
    const leadEmail = (l: Lead) => l.data?.email || l.data?.Email || '';
    const leadPhone = (l: Lead) => l.data?.telefono || l.data?.phone || l.data?.Phone || '';

    return (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-50 dark:bg-slate-900">
            {/* ── Top bar ── */}
            <div className="h-14 shrink-0 flex items-center gap-3 px-4 bg-white/90 dark:bg-slate-800/90 backdrop-blur-md border-b border-slate-200/70 dark:border-slate-700/60">
                <button onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <X size={18} />
                </button>
                <div className="h-5 w-px bg-slate-200 dark:bg-slate-700" />
                <span className="text-sm font-semibold text-slate-800 dark:text-white">
                    {campaign ? 'Modifica campagna' : 'Nuova campagna'}
                </span>
                <div className="ml-auto flex items-center gap-2">
                    {error && <span className="text-xs text-red-500 max-w-xs truncate">{error}</span>}
                    {successMsg && <span className="text-xs text-emerald-600">{successMsg}</span>}
                    <button onClick={onClose}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
                        Annulla
                    </button>
                    {scheduleMode === 'scheduled' ? (
                        <button onClick={handleSchedule} disabled={isSaving || isSending || !scheduledAt}
                            className="flex items-center gap-1.5 px-4 py-1.5 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                            {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Calendar size={13} />}
                            {!scheduledAt ? 'Scegli una data' : 'Pianifica invio'}
                        </button>
                    ) : (
                        <>
                            <button onClick={handleSaveDraft} disabled={isSaving || isSending}
                                className="px-3 py-1.5 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 text-slate-700 dark:text-gray-200 text-xs font-semibold rounded-lg transition-colors">
                                {isSaving ? <Loader2 size={13} className="animate-spin inline mr-1" /> : null}
                                Salva bozza
                            </button>
                            {canSend && (
                                <button onClick={handleSendNow} disabled={isSaving || isSending}
                                    className="flex items-center gap-1.5 px-4 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                                    {isSending ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                                    Invia ora
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 min-h-0 flex overflow-hidden">

                {/* ─── Left panel: impostazioni ─── */}
                <div className="w-80 shrink-0 flex flex-col bg-white/80 dark:bg-slate-800/80 border-r border-slate-200/60 dark:border-slate-700/60 overflow-y-auto">
                    <div className="p-4 space-y-4">

                        {!canSend && (
                            <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-3">
                                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                                Collega e verifica un dominio email prima di inviare.
                            </div>
                        )}

                        {/* Nome + Template */}
                        <div>
                            <label className={labelCls}>Nome campagna</label>
                            <input value={name} onChange={e => setName(e.target.value)}
                                placeholder="Es. Re-engagement agosto" className={inputCls} />
                        </div>

                        <div>
                            <label className={labelCls}>Template email</label>
                            <select value={templateId}
                                onChange={e => {
                                    setTemplateId(e.target.value);
                                    if (!campaign) {
                                        const t = templates.find(t => t.id === e.target.value);
                                        if (t) setSubject(t.subject_template);
                                    }
                                }}
                                className={inputCls}>
                                <option value="">Seleziona template...</option>
                                {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                            </select>
                            {templates.length === 0 && (
                                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Crea prima un template nella sezione Template.</p>
                            )}
                        </div>

                        <div>
                            <label className={labelCls}>Oggetto email</label>
                            <input value={subject} onChange={e => setSubject(e.target.value)}
                                placeholder="Es. {{brand_name}}: una novità per te" className={inputCls} />
                        </div>

                        {/* Pianificazione */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                            <p className={labelCls}>Quando inviare</p>
                            <div className="space-y-2">
                                {([
                                    { id: 'now', label: 'Invia subito', icon: <Zap size={13} /> },
                                    { id: 'scheduled', label: 'Pianifica data', icon: <Calendar size={13} /> },
                                ] as { id: ScheduleMode; label: string; icon: React.ReactNode }[]).map(opt => (
                                    <button key={opt.id} type="button" onClick={() => setScheduleMode(opt.id)}
                                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-all text-sm ${scheduleMode === opt.id
                                            ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-semibold'
                                            : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300'
                                        }`}>
                                        {opt.icon} {opt.label}
                                    </button>
                                ))}
                            </div>
                            {scheduleMode === 'scheduled' && (
                                <div className="mt-2">
                                    <input type="datetime-local" value={scheduledAt}
                                        onChange={e => setScheduledAt(e.target.value)} className={inputCls} />
                                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                                        <Clock size={10} /> Richiede cron job attivo su Vercel.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Filtri */}
                        <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                            <button type="button" onClick={() => setShowFilters(v => !v)}
                                className="w-full flex items-center justify-between mb-2">
                                <span className={labelCls + ' mb-0'}>Filtra le lead</span>
                                {showFilters ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
                            </button>

                            {showFilters && (
                                <div className="space-y-3">
                                    {/* Stato */}
                                    <div>
                                        <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Stato lead</p>
                                        <div className="flex flex-wrap gap-1">
                                            {LEAD_STATUSES.map(s => (
                                                <button key={s} type="button" onClick={() => toggleStatus(s)}
                                                    className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${filterStatuses.includes(s)
                                                        ? 'bg-primary-600 text-white border-primary-600'
                                                        : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:border-slate-300'
                                                    }`}>
                                                    {s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Servizio */}
                                    {availableServices.length > 0 && (
                                        <div>
                                            <p className="text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Servizio</p>
                                            <div className="flex flex-wrap gap-1">
                                                {availableServices.map(s => (
                                                    <button key={s} type="button" onClick={() => toggleService(s)}
                                                        className={`text-[11px] px-2 py-0.5 rounded-full border font-medium transition-colors ${filterServices.includes(s)
                                                            ? 'bg-primary-600 text-white border-primary-600'
                                                            : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 border-transparent hover:border-slate-300'
                                                        }`}>
                                                        {s}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {(filterStatuses.length > 0 || filterServices.length > 0) && (
                                        <button type="button"
                                            onClick={() => { setFilterStatuses([]); setFilterServices([]); }}
                                            className="text-xs text-red-500 hover:text-red-600 underline">
                                            Rimuovi filtri
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ─── Right panel: lead ─── */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Search bar + count */}
                    <div className="shrink-0 px-4 py-3 bg-white/70 dark:bg-slate-800/70 border-b border-slate-200/60 dark:border-slate-700/60 flex items-center gap-3">
                        <div className="relative flex-1 max-w-sm">
                            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={filterSearch}
                                onChange={e => setFilterSearch(e.target.value)}
                                placeholder="Cerca per nome, email, telefono, servizio..."
                                className="w-full pl-8 pr-3 py-2 bg-slate-100 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors"
                            />
                        </div>
                        <div className="flex items-center gap-2 ml-auto">
                            <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                                <Users size={13} />
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedIds.size}</span> selezionate
                                {filteredLeads.length !== allLeads.length && (
                                    <span className="text-slate-400"> · {filteredLeads.length} visibili</span>
                                )}
                            </span>
                            {selectedIds.size > 0 && (
                                <button type="button" onClick={() => setSelectedIds(new Set())}
                                    className="text-xs text-red-500 hover:text-red-600 underline">
                                    Deseleziona tutto
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Lead list */}
                    <div className="flex-1 overflow-y-auto">
                        {isLoadingLeads ? (
                            <div className="flex items-center justify-center h-40">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                            </div>
                        ) : filteredLeads.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 gap-2">
                                <Users size={32} className="text-slate-300 dark:text-slate-600" />
                                <p className="text-sm text-slate-400">Nessuna lead trovata con i filtri selezionati.</p>
                            </div>
                        ) : (
                            <table className="w-full text-sm">
                                <thead className="sticky top-0 bg-slate-100/90 dark:bg-slate-900/90 backdrop-blur-sm border-b border-slate-200 dark:border-slate-700 z-10">
                                    <tr>
                                        <th className="w-10 px-4 py-2.5 text-left">
                                            <button type="button" onClick={toggleAll}
                                                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${allFilteredSelected
                                                    ? 'bg-primary-600 border-primary-600'
                                                    : 'border-slate-300 dark:border-slate-600 hover:border-primary-400'
                                                }`}>
                                                {allFilteredSelected && <Check size={10} className="text-white" />}
                                            </button>
                                        </th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Nome</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Email</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Telefono</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden lg:table-cell">Servizio</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Stato</th>
                                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider hidden md:table-cell">Data</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {filteredLeads.map(lead => {
                                        const selected = selectedIds.has(lead.id);
                                        return (
                                            <tr key={lead.id}
                                                onClick={() => toggleLead(lead.id)}
                                                className={`cursor-pointer transition-colors ${selected
                                                    ? 'bg-primary-50 dark:bg-primary-900/10'
                                                    : 'bg-white dark:bg-slate-800/60 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }`}>
                                                <td className="px-4 py-3">
                                                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${selected
                                                        ? 'bg-primary-600 border-primary-600'
                                                        : 'border-slate-300 dark:border-slate-600'
                                                    }`}>
                                                        {selected && <Check size={10} className="text-white" />}
                                                    </div>
                                                </td>
                                                <td className="px-3 py-3 font-medium text-slate-800 dark:text-white">{leadName(lead)}</td>
                                                <td className="px-3 py-3 text-slate-500 dark:text-slate-400 hidden md:table-cell">
                                                    {leadEmail(lead) || <span className="text-slate-300 dark:text-slate-600 italic text-xs">no email</span>}
                                                </td>
                                                <td className="px-3 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell">{leadPhone(lead) || '—'}</td>
                                                <td className="px-3 py-3 text-slate-500 dark:text-slate-400 hidden lg:table-cell text-xs">{lead.service || '—'}</td>
                                                <td className="px-3 py-3">
                                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_COLORS[lead.status] || 'bg-slate-100 text-slate-600'}`}>
                                                        {lead.status}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-3 text-slate-400 text-xs hidden md:table-cell whitespace-nowrap">
                                                    {new Date(lead.created_at).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MailCampaignModal;
