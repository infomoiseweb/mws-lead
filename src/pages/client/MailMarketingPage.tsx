import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import * as ApiService from '@api';
import { uploadClientLogo } from '@api/storage';
import type { Client, MailDomain, MailBranding, MailTemplate, MailCampaign, MailCampaignRecipient, MailAutomation } from '../../types';
import {
    Loader2, Globe, Palette, Send, Zap, Upload, Image as ImageIcon,
    Copy, Check, RefreshCw, Trash2, AlertCircle, CheckCircle2, Clock,
    Plus, Pencil, FileText, ArrowRight, Settings, BarChart2, Mail,
    ChevronRight, TrendingUp, MousePointer, Eye
} from 'lucide-react';
import MailCampaignModal from '../../components/mail/MailCampaignModal';
import MailAutomationModal from '../../components/mail/MailAutomationModal';
import MailTemplateEditor from '../../components/mail/MailTemplateEditor';

// ─── Types ───────────────────────────────────────────────────────────────────

type View = 'campagne' | 'template' | 'automazioni' | 'impostazioni';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls = "w-full px-3 py-2 bg-slate-100/80 dark:bg-slate-700/60 border border-slate-200 dark:border-slate-600 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500/40 transition-colors";

const domainStatusBadge: Record<MailDomain['status'], { label: string; classes: string; icon: React.ReactNode }> = {
    verified: { label: 'Verificato', classes: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', icon: <CheckCircle2 size={13} /> },
    pending: { label: 'In attesa di verifica', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: <Clock size={13} /> },
    failed: { label: 'Verifica fallita', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: <AlertCircle size={13} /> },
};

const campaignStatusCfg: Record<MailCampaign['status'], { label: string; dot: string }> = {
    draft: { label: 'Bozza', dot: 'bg-slate-400' },
    scheduled: { label: 'Pianificata', dot: 'bg-blue-500' },
    sending: { label: 'Invio in corso', dot: 'bg-amber-500 animate-pulse' },
    sent: { label: 'Inviata', dot: 'bg-emerald-500' },
    failed: { label: 'Fallita', dot: 'bg-red-500' },
};

// ─── Stat chip ────────────────────────────────────────────────────────────────

const StatChip: React.FC<{ label: string; value: string | number; sub?: string; color?: string }> = ({ label, value, sub, color }) => (
    <div className="flex flex-col gap-0.5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 px-5 py-4 min-w-[110px]">
        <span className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wider">{label}</span>
        <span className={`text-2xl font-bold ${color || 'text-slate-800 dark:text-white'}`}>{value}</span>
        {sub && <span className="text-xs text-slate-400">{sub}</span>}
    </div>
);

// ─── Campaign card ────────────────────────────────────────────────────────────

interface CampaignCounts { sent: number; failed: number; pending: number; opened: number; clicked: number }

const CampaignCard: React.FC<{
    campaign: MailCampaign;
    counts?: CampaignCounts;
    onEdit: () => void;
    onDelete: () => void;
}> = ({ campaign, counts, onEdit, onDelete }) => {
    const cfg = campaignStatusCfg[campaign.status];
    const openRate = counts && counts.sent > 0 ? Math.round(counts.opened / counts.sent * 100) : null;
    const clickRate = counts && counts.sent > 0 ? Math.round(counts.clicked / counts.sent * 100) : null;

    return (
        <div className="group bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-5 hover:border-slate-300 dark:hover:border-slate-600 hover:shadow-sm transition-all">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                        <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />
                        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{cfg.label}</span>
                    </div>
                    <button onClick={onEdit} className="font-semibold text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors text-left line-clamp-1">
                        {campaign.name}
                    </button>
                    <p className="text-xs text-slate-400 dark:text-slate-500 truncate mt-0.5">{campaign.subject}</p>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button type="button" onClick={onEdit}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        <Pencil size={13} />
                    </button>
                    {campaign.status === 'draft' && (
                        <button type="button" onClick={onDelete}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            </div>

            {/* Stats row */}
            {counts && campaign.status === 'sent' && (
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/60">
                    <div className="text-center">
                        <div className="text-xs text-slate-400 mb-0.5">Inviate</div>
                        <div className="font-semibold text-sm text-slate-700 dark:text-slate-200">{counts.sent}</div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-0.5">
                            <Eye size={10} /> Aperture
                        </div>
                        <div className="font-semibold text-sm text-blue-600 dark:text-blue-400">
                            {openRate !== null ? `${openRate}%` : '—'}
                        </div>
                    </div>
                    <div className="text-center">
                        <div className="flex items-center justify-center gap-1 text-xs text-slate-400 mb-0.5">
                            <MousePointer size={10} /> Click
                        </div>
                        <div className="font-semibold text-sm text-emerald-600 dark:text-emerald-400">
                            {clickRate !== null ? `${clickRate}%` : '—'}
                        </div>
                    </div>
                </div>
            )}

            {campaign.sent_at && (
                <p className="text-xs text-slate-400 dark:text-slate-500 mt-2">
                    Inviata {new Date(campaign.sent_at).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
            )}
        </div>
    );
};

// ─── Nav item ─────────────────────────────────────────────────────────────────

const NavItem: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void; badge?: string }> = ({ icon, label, active, onClick, badge }) => (
    <button
        onClick={onClick}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
            active
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100/80 dark:hover:bg-slate-700/50 hover:text-slate-800 dark:hover:text-slate-200'
        }`}
    >
        <span className={active ? 'text-primary-600 dark:text-primary-400' : 'text-slate-400 dark:text-slate-500'}>{icon}</span>
        <span className="flex-1 text-left">{label}</span>
        {badge && <span className="text-xs font-semibold px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{badge}</span>}
    </button>
);

// ─── Main component ───────────────────────────────────────────────────────────

const MailMarketingPage: React.FC = () => {
    const { userId } = useParams();

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeView, setActiveView] = useState<View>('campagne');

    // Domain
    const [mailDomain, setMailDomain] = useState<MailDomain | null>(null);
    const [isDomainLoading, setIsDomainLoading] = useState(true);
    const [domainInput, setDomainInput] = useState('');
    const [domainError, setDomainError] = useState('');
    const [isSubmittingDomain, setIsSubmittingDomain] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [deleteDomainConfirm, setDeleteDomainConfirm] = useState(false);

    // Branding
    const [branding, setBranding] = useState<MailBranding>({ primary_color: '#2563eb' });
    const [senderName, setSenderName] = useState('');
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoError, setLogoError] = useState('');
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const [brandingSaved, setBrandingSaved] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Templates
    const [templates, setTemplates] = useState<MailTemplate[]>([]);
    const [templateEditorState, setTemplateEditorState] = useState<{ open: boolean; template: MailTemplate | null }>({ open: false, template: null });

    // Campaigns
    const [campaigns, setCampaigns] = useState<MailCampaign[]>([]);
    const [recipientCounts, setRecipientCounts] = useState<Record<string, CampaignCounts>>({});
    const [isCampaignsLoading, setIsCampaignsLoading] = useState(true);
    const [campaignsError, setCampaignsError] = useState('');
    const [campaignModalState, setCampaignModalState] = useState<{ open: boolean; campaign: MailCampaign | null }>({ open: false, campaign: null });

    // Automations
    const [automations, setAutomations] = useState<MailAutomation[]>([]);
    const [isAutomationsLoading, setIsAutomationsLoading] = useState(true);
    const [automationsError, setAutomationsError] = useState('');
    const [automationModalState, setAutomationModalState] = useState<{ open: boolean; automation: MailAutomation | null }>({ open: false, automation: null });

    // ── Data fetching ──────────────────────────────────────────────────────────

    const fetchData = useCallback(async () => {
        if (!userId) return;
        setIsLoading(true);
        try {
            const data = await ApiService.getClientByUserId(userId);
            setClient(data);
            if (data?.marketing_settings?.branding) setBranding(data.marketing_settings.branding);
            if (data?.marketing_settings?.sender_name) setSenderName(data.marketing_settings.sender_name);
        } finally {
            setIsLoading(false);
        }
    }, [userId]);

    const fetchDomain = useCallback(async () => {
        setIsDomainLoading(true);
        try {
            const domain = await ApiService.getMailDomain();
            setMailDomain(domain);
        } catch (err: any) {
            setDomainError(err.message || 'Errore caricamento dominio.');
        } finally {
            setIsDomainLoading(false);
        }
    }, []);

    const fetchCampaignsData = useCallback(async (clientId: string) => {
        setIsCampaignsLoading(true);
        setCampaignsError('');
        try {
            const [tpls, camps] = await Promise.all([
                ApiService.getMailTemplates(clientId),
                ApiService.getMailCampaigns(clientId),
            ]);
            setTemplates(tpls);
            setCampaigns(camps);
            const sentCampaigns = camps.filter(c => c.status === 'sent' || c.status === 'failed');
            const counts: Record<string, CampaignCounts> = {};
            await Promise.all(sentCampaigns.map(async c => {
                const r = await ApiService.getMailCampaignRecipients(c.id);
                counts[c.id] = {
                    sent: r.filter((x: MailCampaignRecipient) => x.status === 'sent' || x.status === 'bounced').length,
                    failed: r.filter((x: MailCampaignRecipient) => x.status === 'failed').length,
                    pending: r.filter((x: MailCampaignRecipient) => x.status === 'pending').length,
                    opened: r.filter((x: MailCampaignRecipient) => x.opened_at).length,
                    clicked: r.filter((x: MailCampaignRecipient) => x.clicked_at).length,
                };
            }));
            setRecipientCounts(counts);
        } catch (err: any) {
            setCampaignsError(err.message || 'Errore campagne.');
        } finally {
            setIsCampaignsLoading(false);
        }
    }, []);

    const fetchAutomations = useCallback(async (clientId: string) => {
        setIsAutomationsLoading(true);
        try {
            const data = await ApiService.getMailAutomations(clientId);
            setAutomations(data);
        } catch (err: any) {
            setAutomationsError(err.message || 'Errore automazioni.');
        } finally {
            setIsAutomationsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchDomain(); }, [fetchDomain]);
    useEffect(() => { if (client) fetchCampaignsData(client.id); }, [client, fetchCampaignsData]);
    useEffect(() => { if (client) fetchAutomations(client.id); }, [client, fetchAutomations]);

    // ── Handlers ───────────────────────────────────────────────────────────────

    const handleAddDomain = async () => {
        if (!domainInput.trim()) return;
        setDomainError(''); setIsSubmittingDomain(true);
        try {
            const created = await ApiService.createMailDomain(domainInput.trim());
            setMailDomain(created); setDomainInput('');
        } catch (err: any) { setDomainError(err.message || 'Errore creazione dominio.'); }
        finally { setIsSubmittingDomain(false); }
    };

    const handleVerifyDomain = async () => {
        if (!mailDomain) return;
        setDomainError(''); setIsVerifying(true);
        try {
            const updated = await ApiService.verifyMailDomain(mailDomain.id);
            setMailDomain(updated);
        } catch (err: any) { setDomainError(err.message || 'Errore verifica.'); }
        finally { setIsVerifying(false); }
    };

    const handleDeleteDomain = async () => {
        if (!mailDomain) return;
        try {
            await ApiService.deleteMailDomain(mailDomain.id);
            setMailDomain(null); setDeleteDomainConfirm(false);
        } catch (err: any) { setDomainError(err.message || 'Errore rimozione.'); }
    };

    const handleCopy = (field: string, value: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(field); setTimeout(() => setCopiedField(null), 1500);
        });
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client) return;
        setLogoError(''); setIsUploadingLogo(true);
        try {
            const url = await uploadClientLogo(client.id, file);
            setBranding(prev => ({ ...prev, logo_url: url }));
        } catch (err: any) { setLogoError(err.message || 'Errore upload logo.'); }
        finally { setIsUploadingLogo(false); if (logoInputRef.current) logoInputRef.current.value = ''; }
    };

    const handleSaveBranding = async () => {
        if (!client) return;
        setIsSavingBranding(true);
        try {
            const updated = await ApiService.updateMarketingSettings(client.id, { ...client.marketing_settings, branding, sender_name: senderName });
            setClient(prev => prev ? { ...prev, marketing_settings: updated } : prev);
            setBrandingSaved(true); setTimeout(() => setBrandingSaved(false), 2000);
        } catch (err: any) { setLogoError(err.message || 'Errore salvataggio.'); }
        finally { setIsSavingBranding(false); }
    };

    const handleTemplateSaved = (saved: MailTemplate) => {
        setTemplates(prev => {
            const exists = prev.some(t => t.id === saved.id);
            return exists ? prev.map(t => t.id === saved.id ? saved : t) : [saved, ...prev];
        });
    };

    const handleTemplateDeleted = (templateId: string) => {
        setTemplates(prev => prev.filter(t => t.id !== templateId));
    };

    const handleCampaignSaved = (saved: MailCampaign) => {
        setCampaigns(prev => {
            const exists = prev.some(c => c.id === saved.id);
            return exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
        });
        if (saved.status === 'sent' || saved.status === 'failed') {
            ApiService.getMailCampaignRecipients(saved.id).then(r => {
                setRecipientCounts(prev => ({
                    ...prev,
                    [saved.id]: {
                        sent: r.filter((x: MailCampaignRecipient) => x.status === 'sent' || x.status === 'bounced').length,
                        failed: r.filter((x: MailCampaignRecipient) => x.status === 'failed').length,
                        pending: r.filter((x: MailCampaignRecipient) => x.status === 'pending').length,
                        opened: r.filter((x: MailCampaignRecipient) => x.opened_at).length,
                        clicked: r.filter((x: MailCampaignRecipient) => x.clicked_at).length,
                    },
                }));
            }).catch(() => {});
        }
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        try {
            await ApiService.deleteMailCampaign(campaignId);
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        } catch (err: any) { setCampaignsError(err.message || 'Errore eliminazione.'); }
    };

    const handleAutomationSaved = (saved: MailAutomation) => {
        setAutomations(prev => {
            const exists = prev.some(a => a.id === saved.id);
            return exists ? prev.map(a => a.id === saved.id ? saved : a) : [saved, ...prev];
        });
    };

    const handleToggleAutomation = async (automation: MailAutomation) => {
        try {
            const saved = await ApiService.saveMailAutomation({ id: automation.id, client_id: automation.client_id, active: !automation.active });
            handleAutomationSaved(saved);
        } catch (err: any) { setAutomationsError(err.message || 'Errore.'); }
    };

    const handleDeleteAutomation = async (automationId: string) => {
        try {
            await ApiService.deleteMailAutomation(automationId);
            setAutomations(prev => prev.filter(a => a.id !== automationId));
        } catch (err: any) { setAutomationsError(err.message || 'Errore.'); }
    };

    // ── Stats for sidebar badge ─────────────────────────────────────────────

    const totalSent = campaigns.filter(c => c.status === 'sent').length;
    const allCounts = Object.values(recipientCounts);
    const totalEmails = allCounts.reduce((s, c) => s + c.sent, 0);
    const totalOpened = allCounts.reduce((s, c) => s + c.opened, 0);
    const avgOpenRate = totalEmails > 0 ? Math.round(totalOpened / totalEmails * 100) : null;

    // ── Guards ─────────────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (!client?.mail_marketing_enabled) {
        return (
            <div className="max-w-lg mx-auto mt-16 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl p-10 text-center border border-slate-200/60 dark:border-slate-700/60">
                <Mail size={40} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-2">Mail Marketing non attivo</h2>
                <p className="text-sm text-slate-400 dark:text-slate-500">
                    La sezione Mail Marketing non è ancora attiva per il tuo account. Contatta il tuo referente per attivarla.
                </p>
            </div>
        );
    }

    const domainVerified = mailDomain?.status === 'verified';

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <>
            {/* Template editor overlay */}
            {templateEditorState.open && client && (
                <MailTemplateEditor
                    template={templateEditorState.template}
                    clientId={client.id}
                    branding={branding}
                    onSaved={handleTemplateSaved}
                    onClose={() => setTemplateEditorState({ open: false, template: null })}
                />
            )}

            <div className="flex gap-5 min-h-full">
                {/* ── Sidebar ── */}
                <aside className="w-52 shrink-0 flex flex-col gap-1">
                    <div className="mb-3">
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider px-3 mb-2">Mail Marketing</p>
                    </div>

                    <NavItem icon={<Send size={16} />} label="Campagne" active={activeView === 'campagne'} onClick={() => setActiveView('campagne')} badge={totalSent > 0 ? String(totalSent) : undefined} />
                    <NavItem icon={<FileText size={16} />} label="Template" active={activeView === 'template'} onClick={() => setActiveView('template')} badge={templates.length > 0 ? String(templates.length) : undefined} />
                    <NavItem icon={<Zap size={16} />} label="Automazioni" active={activeView === 'automazioni'} onClick={() => setActiveView('automazioni')} badge={automations.filter(a => a.active).length > 0 ? String(automations.filter(a => a.active).length) : undefined} />
                    <NavItem icon={<Settings size={16} />} label="Impostazioni" active={activeView === 'impostazioni'} onClick={() => setActiveView('impostazioni')} />

                    {/* Domain status hint */}
                    <div className="mt-auto pt-4">
                        <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs ${
                            domainVerified
                                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400'
                                : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400'
                        }`}>
                            {domainVerified ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                            <span className="font-medium truncate">{domainVerified ? (mailDomain?.domain || 'Dominio OK') : 'Dominio non verificato'}</span>
                        </div>
                    </div>
                </aside>

                {/* ── Main content ── */}
                <main className="flex-1 min-w-0 space-y-5">

                    {/* ═══════════════ CAMPAGNE ═══════════════ */}
                    {activeView === 'campagne' && (
                        <div className="space-y-5">
                            {/* Stats */}
                            {campaigns.length > 0 && (
                                <div className="flex flex-wrap gap-3">
                                    <StatChip label="Campagne inviate" value={totalSent} />
                                    <StatChip label="Email consegnate" value={totalEmails.toLocaleString('it-IT')} />
                                    {avgOpenRate !== null && (
                                        <StatChip label="Aperture medie" value={`${avgOpenRate}%`} color="text-blue-600 dark:text-blue-400" />
                                    )}
                                </div>
                            )}

                            {/* Header */}
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Campagne</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Crea e invia campagne email alle tue lead.</p>
                                </div>
                                <button
                                    onClick={() => setCampaignModalState({ open: true, campaign: null })}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    <Plus size={15} /> Nuova campagna
                                </button>
                            </div>

                            {campaignsError && (
                                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">{campaignsError}</div>
                            )}

                            {isCampaignsLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                </div>
                            ) : campaigns.length === 0 ? (
                                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-12 text-center">
                                    <Send size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nessuna campagna creata</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Crea la tua prima campagna per iniziare a contattare le lead.</p>
                                    {!domainVerified && (
                                        <button onClick={() => setActiveView('impostazioni')} className="mt-4 text-xs text-amber-600 dark:text-amber-400 underline">
                                            Prima configura il dominio email →
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                                    {campaigns.map(camp => (
                                        <CampaignCard
                                            key={camp.id}
                                            campaign={camp}
                                            counts={recipientCounts[camp.id]}
                                            onEdit={() => setCampaignModalState({ open: true, campaign: camp })}
                                            onDelete={() => handleDeleteCampaign(camp.id)}
                                        />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════════════ TEMPLATE ═══════════════ */}
                    {activeView === 'template' && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Template email</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Progetta i template riutilizzabili nelle campagne.</p>
                                </div>
                                <button
                                    onClick={() => setTemplateEditorState({ open: true, template: null })}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    <Plus size={15} /> Nuovo template
                                </button>
                            </div>

                            {isCampaignsLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-12 text-center">
                                    <FileText size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nessun template</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Crea il tuo primo template email per usarlo nelle campagne.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                    {templates.map(tpl => (
                                        <div key={tpl.id}
                                            className="group bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 overflow-hidden hover:border-slate-300 dark:hover:border-slate-500 hover:shadow-sm transition-all">
                                            {/* Color strip */}
                                            <div className="h-1.5" style={{ backgroundColor: branding.primary_color || '#2563eb' }} />
                                            <div className="p-4">
                                                <div className="flex items-start justify-between gap-2 mb-2">
                                                    <div>
                                                        <p className="font-semibold text-sm text-slate-800 dark:text-white line-clamp-1">{tpl.name}</p>
                                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5 truncate">{tpl.subject_template}</p>
                                                    </div>
                                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                        <button type="button"
                                                            onClick={() => setTemplateEditorState({ open: true, template: tpl })}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                            <Pencil size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => setTemplateEditorState({ open: true, template: tpl })}
                                                    className="w-full mt-2 text-xs font-semibold text-primary-600 dark:text-primary-400 hover:text-primary-700 text-left flex items-center gap-1 transition-colors">
                                                    Modifica <ChevronRight size={12} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════════════ AUTOMAZIONI ═══════════════ */}
                    {activeView === 'automazioni' && (
                        <div className="space-y-5">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h2 className="text-lg font-bold text-slate-800 dark:text-white">Automazioni</h2>
                                    <p className="text-sm text-slate-500 dark:text-slate-400">Email inviate automaticamente in base agli eventi delle lead.</p>
                                </div>
                                <button
                                    onClick={() => setAutomationModalState({ open: true, automation: null })}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm"
                                >
                                    <Plus size={15} /> Nuova automazione
                                </button>
                            </div>

                            {!domainVerified && (
                                <div className="flex items-center gap-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 text-sm text-amber-700 dark:text-amber-400">
                                    <AlertCircle size={16} className="shrink-0" />
                                    <span>Per attivare le automazioni devi prima <button onClick={() => setActiveView('impostazioni')} className="underline font-medium">collegare e verificare un dominio email</button>.</span>
                                </div>
                            )}

                            {automationsError && (
                                <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">{automationsError}</div>
                            )}

                            {isAutomationsLoading ? (
                                <div className="flex items-center justify-center py-16">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                                </div>
                            ) : automations.length === 0 ? (
                                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-12 text-center">
                                    <Zap size={36} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300 mb-1">Nessuna automazione</p>
                                    <p className="text-xs text-slate-400 dark:text-slate-500">Crea regole per inviare email automaticamente quando una lead arriva o cambia stato.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {automations.map(auto => {
                                        const tpl = templates.find(t => t.id === auto.template_id);
                                        const triggerLabel = auto.trigger_type === 'lead_created'
                                            ? 'Nuova lead'
                                            : `Stato → ${auto.trigger_status}`;
                                        return (
                                            <div key={auto.id} className={`bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-2xl border transition-all ${auto.active ? 'border-slate-200/60 dark:border-slate-700/60' : 'border-slate-200/40 dark:border-slate-700/40 opacity-60'} p-4`}>
                                                <div className="flex flex-wrap items-center gap-3">
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-sm text-slate-800 dark:text-white">{auto.name}</p>
                                                        <div className="flex flex-wrap items-center gap-2 mt-1">
                                                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg">
                                                                {triggerLabel} <ArrowRight size={11} /> {auto.delay_hours === 0 ? 'subito' : `dopo ${auto.delay_hours}h`}
                                                            </span>
                                                            {tpl && (
                                                                <span className="inline-flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500">
                                                                    <FileText size={11} /> {tpl.name}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2 ml-auto">
                                                        <button type="button"
                                                            onClick={() => handleToggleAutomation(auto)}
                                                            role="switch"
                                                            aria-checked={auto.active}
                                                            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${auto.active ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                        >
                                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${auto.active ? 'translate-x-4' : 'translate-x-1'}`} />
                                                        </button>
                                                        <button type="button" onClick={() => setAutomationModalState({ open: true, automation: auto })}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                                            <Pencil size={14} />
                                                        </button>
                                                        <button type="button" onClick={() => handleDeleteAutomation(auto.id)}
                                                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}

                    {/* ═══════════════ IMPOSTAZIONI ═══════════════ */}
                    {activeView === 'impostazioni' && (
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Impostazioni</h2>

                            {/* ── Dominio ── */}
                            <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 space-y-4">
                                <div className="flex items-center gap-3 mb-1">
                                    <Globe size={18} className="text-slate-400" />
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-white">Dominio email</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">
                                            Collega un dominio (es. <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-900/40 rounded text-xs">mail.tuodominio.it</code>) per inviare le campagne dal tuo brand.
                                        </p>
                                    </div>
                                </div>

                                {domainError && (
                                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-xl p-3">{domainError}</div>
                                )}

                                {isDomainLoading ? (
                                    <div className="flex items-center justify-center py-6">
                                        <Loader2 className="w-5 h-5 animate-spin text-primary-500" />
                                    </div>
                                ) : !mailDomain ? (
                                    <div className="flex flex-col sm:flex-row gap-3 items-end">
                                        <div className="flex-1">
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Dominio</label>
                                            <input type="text" value={domainInput} onChange={e => setDomainInput(e.target.value)}
                                                placeholder="mail.tuodominio.it" className={inputCls} />
                                        </div>
                                        <button onClick={handleAddDomain} disabled={isSubmittingDomain || !domainInput.trim()}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                                            {isSubmittingDomain ? <Loader2 size={14} className="animate-spin" /> : <Globe size={14} />}
                                            Collega dominio
                                        </button>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        <div className="flex flex-wrap items-center gap-3">
                                            <span className="font-mono text-sm text-slate-700 dark:text-slate-200 font-semibold">{mailDomain.domain}</span>
                                            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${domainStatusBadge[mailDomain.status].classes}`}>
                                                {domainStatusBadge[mailDomain.status].icon}
                                                {domainStatusBadge[mailDomain.status].label}
                                            </span>
                                        </div>

                                        {mailDomain.status !== 'verified' && mailDomain.dns_records && mailDomain.dns_records.length > 0 && (
                                            <>
                                                <p className="text-xs text-slate-500 dark:text-slate-400">
                                                    Aggiungi questi record DNS nel tuo provider, poi premi "Verifica ora". La propagazione può richiedere fino a qualche ora.
                                                </p>
                                                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                                                    <table className="min-w-full text-xs">
                                                        <thead className="bg-slate-50 dark:bg-slate-900/50">
                                                            <tr className="text-left text-slate-400 dark:text-slate-500">
                                                                <th className="px-3 py-2 font-medium">Tipo</th>
                                                                <th className="px-3 py-2 font-medium">Nome</th>
                                                                <th className="px-3 py-2 font-medium">Valore</th>
                                                                <th className="px-3 py-2 font-medium">TTL</th>
                                                                <th className="px-3 py-2 font-medium w-8"></th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                            {mailDomain.dns_records.map((rec, idx) => (
                                                                <tr key={idx} className="bg-white dark:bg-slate-800">
                                                                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200 whitespace-nowrap">{rec.type}</td>
                                                                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200 max-w-[160px] truncate" title={rec.name}>{rec.name}</td>
                                                                    <td className="px-3 py-2 font-mono text-slate-700 dark:text-slate-200 max-w-[220px] truncate" title={rec.value}>{rec.value}</td>
                                                                    <td className="px-3 py-2 font-mono text-slate-400 whitespace-nowrap">{rec.ttl || '—'}</td>
                                                                    <td className="px-3 py-2">
                                                                        <button onClick={() => handleCopy(`${rec.type}-${idx}`, rec.value)}
                                                                            className="p-1 text-slate-400 hover:text-primary-500 rounded transition-colors">
                                                                            {copiedField === `${rec.type}-${idx}` ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                                                                        </button>
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </>
                                        )}

                                        <div className="flex items-center gap-2 pt-2">
                                            <button onClick={handleVerifyDomain} disabled={isVerifying}
                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold rounded-lg transition-colors">
                                                {isVerifying ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
                                                Verifica ora
                                            </button>
                                            {!deleteDomainConfirm ? (
                                                <button onClick={() => setDeleteDomainConfirm(true)}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs font-semibold rounded-lg transition-colors">
                                                    <Trash2 size={13} /> Rimuovi
                                                </button>
                                            ) : (
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xs text-slate-500">Confermi?</span>
                                                    <button onClick={handleDeleteDomain} className="px-2 py-1 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg">Sì</button>
                                                    <button onClick={() => setDeleteDomainConfirm(false)} className="px-2 py-1 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">No</button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ── Branding ── */}
                            <div className="bg-white/85 dark:bg-slate-800/85 backdrop-blur-sm rounded-2xl border border-slate-200/60 dark:border-slate-700/60 p-6 space-y-5">
                                <div className="flex items-center gap-3 mb-1">
                                    <Palette size={18} className="text-slate-400" />
                                    <div>
                                        <h3 className="font-semibold text-slate-800 dark:text-white">Branding email</h3>
                                        <p className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">Logo, colori e footer usati in tutte le email.</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        {/* Logo */}
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Logo</label>
                                            <div className="flex items-center gap-3">
                                                <div className="w-16 h-16 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden bg-slate-50 dark:bg-slate-900/40 shrink-0">
                                                    {branding.logo_url ? (
                                                        <img src={branding.logo_url} alt="Logo" className="max-w-full max-h-full object-contain" />
                                                    ) : (
                                                        <ImageIcon size={18} className="text-slate-300 dark:text-slate-600" />
                                                    )}
                                                </div>
                                                <div className="space-y-1.5">
                                                    <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="mail-logo-input" />
                                                    <label htmlFor="mail-logo-input"
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold rounded-lg cursor-pointer transition-colors">
                                                        <Upload size={12} /> {isUploadingLogo ? 'Caricamento...' : 'Carica logo'}
                                                    </label>
                                                    {branding.logo_url && (
                                                        <button onClick={() => setBranding(prev => ({ ...prev, logo_url: undefined }))}
                                                            className="block text-xs text-red-500 hover:text-red-600 transition-colors">
                                                            Rimuovi
                                                        </button>
                                                    )}
                                                    {logoError && <p className="text-xs text-red-500">{logoError}</p>}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Brand name */}
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Nome brand</label>
                                            <input type="text" value={branding.brand_name || ''} onChange={e => setBranding(prev => ({ ...prev, brand_name: e.target.value }))}
                                                placeholder={client?.name} className={inputCls} />
                                        </div>

                                        {/* Sender name */}
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Nome mittente</label>
                                            <input type="text" value={senderName} onChange={e => setSenderName(e.target.value)}
                                                placeholder={client?.name} className={inputCls} />
                                            <p className="text-xs text-slate-400 mt-1">
                                                Es: "{senderName || client?.name} &lt;noreply@{mailDomain?.domain || 'tuodominio.it'}&gt;"
                                            </p>
                                        </div>

                                        {/* Colors */}
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Colore principale</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={branding.primary_color || '#2563eb'}
                                                        onChange={e => setBranding(prev => ({ ...prev, primary_color: e.target.value }))}
                                                        className="h-9 w-12 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent" />
                                                    <span className="text-xs font-mono text-slate-500">{branding.primary_color || '#2563eb'}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Colore secondario</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={branding.secondary_color || '#1e293b'}
                                                        onChange={e => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                                                        className="h-9 w-12 rounded-lg border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent" />
                                                    <span className="text-xs font-mono text-slate-500">{branding.secondary_color || '#1e293b'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Footer */}
                                        <div>
                                            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 block">Testo footer</label>
                                            <textarea value={branding.footer_text || ''} onChange={e => setBranding(prev => ({ ...prev, footer_text: e.target.value }))}
                                                placeholder={`${client?.name || ''} — Via Roma 1, Milano`} rows={2} className={inputCls} />
                                        </div>

                                        <button onClick={handleSaveBranding} disabled={isSavingBranding}
                                            className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors">
                                            {isSavingBranding ? <Loader2 size={14} className="animate-spin" /> : brandingSaved ? <Check size={14} /> : null}
                                            {brandingSaved ? 'Salvato!' : 'Salva impostazioni'}
                                        </button>
                                    </div>

                                    {/* Preview */}
                                    <div>
                                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Anteprima</label>
                                        <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
                                            <div className="p-5 text-center" style={{ backgroundColor: branding.secondary_color || '#1e293b' }}>
                                                {branding.logo_url ? (
                                                    <img src={branding.logo_url} alt="Logo" className="h-10 mx-auto object-contain" />
                                                ) : (
                                                    <span className="text-white font-bold text-lg">{branding.brand_name || client?.name}</span>
                                                )}
                                            </div>
                                            <div className="p-5 bg-white dark:bg-slate-900 space-y-3">
                                                <h4 className="font-bold" style={{ color: branding.primary_color || '#2563eb' }}>Titolo della campagna</h4>
                                                <p className="text-sm text-slate-600 dark:text-slate-300">Ciao Mario, ecco la nostra ultima novità...</p>
                                                <div>
                                                    <span className="inline-block text-sm font-semibold px-4 py-2 rounded-lg text-white" style={{ backgroundColor: branding.primary_color || '#2563eb' }}>
                                                        Scopri di più
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-400 dark:text-slate-500 whitespace-pre-line border-t border-slate-200 dark:border-slate-700 text-center">
                                                {branding.footer_text || client?.name}{'\n'}
                                                <span className="underline">Annulla l'iscrizione</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>

            {/* ── Modals ── */}
            {client && (
                <>
                    <MailCampaignModal
                        isOpen={campaignModalState.open}
                        onClose={() => setCampaignModalState({ open: false, campaign: null })}
                        campaign={campaignModalState.campaign}
                        client={client}
                        templates={templates}
                        canSend={domainVerified}
                        onSaved={handleCampaignSaved}
                    />
                    <MailAutomationModal
                        isOpen={automationModalState.open}
                        onClose={() => setAutomationModalState({ open: false, automation: null })}
                        automation={automationModalState.automation}
                        clientId={client.id}
                        templates={templates}
                        onSaved={handleAutomationSaved}
                    />
                </>
            )}
        </>
    );
};

export default MailMarketingPage;
