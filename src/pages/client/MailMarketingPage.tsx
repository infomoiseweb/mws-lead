import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import * as ApiService from '@api';
import { uploadClientLogo } from '@api/storage';
import type { Client, MailDomain, MailBranding, MailTemplate, MailCampaign, MailCampaignRecipient, MailAutomation } from '../../types';
import {
    Loader2, Globe, Palette, Send, Zap, Upload, Image as ImageIcon,
    Copy, Check, RefreshCw, Trash2, AlertCircle, CheckCircle2, Clock, Plus, Pencil, FileText, ArrowRight
} from 'lucide-react';
import MailTemplateModal from '../../components/mail/MailTemplateModal';
import MailCampaignModal from '../../components/mail/MailCampaignModal';
import MailAutomationModal from '../../components/mail/MailAutomationModal';

type TabKey = 'dominio' | 'branding' | 'campagne' | 'automazioni';

const inputCls = "w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-md text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500";

const statusBadge: Record<MailDomain['status'], { label: string; classes: string; icon: React.ReactNode }> = {
    verified: { label: 'Verificato', classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400', icon: <CheckCircle2 size={14} /> },
    pending: { label: 'In attesa di verifica', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', icon: <Clock size={14} /> },
    failed: { label: 'Verifica fallita', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', icon: <AlertCircle size={14} /> },
};

const campaignStatusBadge: Record<MailCampaign['status'], { label: string; classes: string }> = {
    draft: { label: 'Bozza', classes: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-gray-300' },
    scheduled: { label: 'Pianificata', classes: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400' },
    sending: { label: 'Invio in corso', classes: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
    sent: { label: 'Inviata', classes: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400' },
    failed: { label: 'Fallita', classes: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400' },
};

const MailMarketingPage: React.FC = () => {
    const { t } = useTranslation();
    const { userId } = useParams();

    const [client, setClient] = useState<Client | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabKey>('dominio');

    // Dominio
    const [mailDomain, setMailDomain] = useState<MailDomain | null>(null);
    const [isDomainLoading, setIsDomainLoading] = useState(true);
    const [domainInput, setDomainInput] = useState('');
    const [domainError, setDomainError] = useState('');
    const [isSubmittingDomain, setIsSubmittingDomain] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [copiedField, setCopiedField] = useState<string | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState(false);

    // Branding
    const [branding, setBranding] = useState<MailBranding>({ primary_color: '#2563eb' });
    const [senderName, setSenderName] = useState('');
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [logoError, setLogoError] = useState('');
    const [isSavingBranding, setIsSavingBranding] = useState(false);
    const [brandingSaved, setBrandingSaved] = useState(false);
    const logoInputRef = useRef<HTMLInputElement>(null);

    // Campagne
    const [templates, setTemplates] = useState<MailTemplate[]>([]);
    const [campaigns, setCampaigns] = useState<MailCampaign[]>([]);
    const [recipientCounts, setRecipientCounts] = useState<Record<string, { sent: number; failed: number; pending: number }>>({});
    const [isCampaignsLoading, setIsCampaignsLoading] = useState(true);
    const [campaignsError, setCampaignsError] = useState('');
    const [templateModalState, setTemplateModalState] = useState<{ open: boolean; template: MailTemplate | null }>({ open: false, template: null });
    const [campaignModalState, setCampaignModalState] = useState<{ open: boolean; campaign: MailCampaign | null }>({ open: false, campaign: null });

    // Automazioni
    const [automations, setAutomations] = useState<MailAutomation[]>([]);
    const [isAutomationsLoading, setIsAutomationsLoading] = useState(true);
    const [automationsError, setAutomationsError] = useState('');
    const [automationModalState, setAutomationModalState] = useState<{ open: boolean; automation: MailAutomation | null }>({ open: false, automation: null });

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
            setDomainError(err.message || 'Errore durante il caricamento del dominio.');
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
            const counts: Record<string, { sent: number; failed: number; pending: number }> = {};
            await Promise.all(sentCampaigns.map(async c => {
                const recipients = await ApiService.getMailCampaignRecipients(c.id);
                counts[c.id] = {
                    sent: recipients.filter((r: MailCampaignRecipient) => r.status === 'sent').length,
                    failed: recipients.filter((r: MailCampaignRecipient) => r.status === 'failed' || r.status === 'bounced').length,
                    pending: recipients.filter((r: MailCampaignRecipient) => r.status === 'pending').length,
                };
            }));
            setRecipientCounts(counts);
        } catch (err: any) {
            setCampaignsError(err.message || 'Errore durante il caricamento delle campagne.');
        } finally {
            setIsCampaignsLoading(false);
        }
    }, []);

    const fetchAutomationsData = useCallback(async (clientId: string) => {
        setIsAutomationsLoading(true);
        setAutomationsError('');
        try {
            const data = await ApiService.getMailAutomations(clientId);
            setAutomations(data);
        } catch (err: any) {
            setAutomationsError(err.message || 'Errore durante il caricamento delle automazioni.');
        } finally {
            setIsAutomationsLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);
    useEffect(() => { fetchDomain(); }, [fetchDomain]);
    useEffect(() => { if (client) fetchCampaignsData(client.id); }, [client, fetchCampaignsData]);
    useEffect(() => { if (client) fetchAutomationsData(client.id); }, [client, fetchAutomationsData]);

    const handleAddDomain = async () => {
        if (!domainInput.trim()) return;
        setDomainError('');
        setIsSubmittingDomain(true);
        try {
            const created = await ApiService.createMailDomain(domainInput.trim());
            setMailDomain(created);
            setDomainInput('');
        } catch (err: any) {
            setDomainError(err.message || 'Errore durante la creazione del dominio.');
        } finally {
            setIsSubmittingDomain(false);
        }
    };

    const handleVerifyDomain = async () => {
        if (!mailDomain) return;
        setDomainError('');
        setIsVerifying(true);
        try {
            const updated = await ApiService.verifyMailDomain(mailDomain.id);
            setMailDomain(updated);
        } catch (err: any) {
            setDomainError(err.message || 'Errore durante la verifica del dominio.');
        } finally {
            setIsVerifying(false);
        }
    };

    const handleDeleteDomain = async () => {
        if (!mailDomain) return;
        setDomainError('');
        try {
            await ApiService.deleteMailDomain(mailDomain.id);
            setMailDomain(null);
            setDeleteConfirm(false);
        } catch (err: any) {
            setDomainError(err.message || 'Errore durante la rimozione del dominio.');
        }
    };

    const handleCopy = (field: string, value: string) => {
        navigator.clipboard.writeText(value).then(() => {
            setCopiedField(field);
            setTimeout(() => setCopiedField(null), 1500);
        });
    };

    const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !client) return;
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

    const handleSaveBranding = async () => {
        if (!client) return;
        setIsSavingBranding(true);
        try {
            const updated = await ApiService.updateMarketingSettings(client.id, {
                ...client.marketing_settings,
                branding,
                sender_name: senderName,
            });
            setClient(prev => prev ? { ...prev, marketing_settings: updated } : prev);
            setBrandingSaved(true);
            setTimeout(() => setBrandingSaved(false), 2000);
        } catch (err: any) {
            setLogoError(err.message || 'Errore durante il salvataggio.');
        } finally {
            setIsSavingBranding(false);
        }
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
            const next = exists ? prev.map(c => c.id === saved.id ? saved : c) : [saved, ...prev];
            return next;
        });
        if (saved.status === 'sent' || saved.status === 'failed') {
            ApiService.getMailCampaignRecipients(saved.id).then(recipients => {
                setRecipientCounts(prev => ({
                    ...prev,
                    [saved.id]: {
                        sent: recipients.filter((r: MailCampaignRecipient) => r.status === 'sent').length,
                        failed: recipients.filter((r: MailCampaignRecipient) => r.status === 'failed' || r.status === 'bounced').length,
                        pending: recipients.filter((r: MailCampaignRecipient) => r.status === 'pending').length,
                    },
                }));
            }).catch(() => {});
        }
    };

    const handleDeleteCampaign = async (campaignId: string) => {
        try {
            await ApiService.deleteMailCampaign(campaignId);
            setCampaigns(prev => prev.filter(c => c.id !== campaignId));
        } catch (err: any) {
            setCampaignsError(err.message || 'Errore durante l\'eliminazione della campagna.');
        }
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
        } catch (err: any) {
            setAutomationsError(err.message || 'Errore durante l\'aggiornamento dell\'automazione.');
        }
    };

    const handleDeleteAutomation = async (automationId: string) => {
        try {
            await ApiService.deleteMailAutomation(automationId);
            setAutomations(prev => prev.filter(a => a.id !== automationId));
        } catch (err: any) {
            setAutomationsError(err.message || 'Errore durante l\'eliminazione dell\'automazione.');
        }
    };

    const tabs: { id: TabKey; label: string; icon: React.ReactNode }[] = [
        { id: 'dominio', label: 'Dominio', icon: <Globe size={16} className="mr-2" /> },
        { id: 'branding', label: 'Branding & Template', icon: <Palette size={16} className="mr-2" /> },
        { id: 'campagne', label: 'Campagne', icon: <Send size={16} className="mr-2" /> },
        { id: 'automazioni', label: 'Automazioni', icon: <Zap size={16} className="mr-2" /> },
    ];

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Mail Marketing</h1>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                    Collega il tuo dominio, personalizza il tuo brand e invia campagne email alle tue lead.
                </p>
            </div>

            <div className="border-b border-slate-200 dark:border-slate-700">
                <nav className="-mb-px flex space-x-4 overflow-x-auto" aria-label="Tabs">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`whitespace-nowrap flex items-center py-3 px-1 border-b-2 font-medium text-sm transition-colors ${
                                activeTab === tab.id
                                    ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:border-gray-600'
                            }`}
                            aria-current={activeTab === tab.id ? 'page' : undefined}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </nav>
            </div>

            {activeTab === 'dominio' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Dominio email</h3>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            Collega un tuo dominio (es. <code className="px-1 py-0.5 bg-slate-100 dark:bg-slate-900/50 rounded">mail.tuodominio.it</code>) per inviare le campagne mail marketing dal tuo brand. Dopo aver aggiunto il dominio, aggiungi i record DNS mostrati qui sotto nel tuo provider DNS, poi premi "Verifica ora".
                        </p>
                    </div>

                    {domainError && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{domainError}</div>
                    )}

                    {isDomainLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        </div>
                    ) : !mailDomain ? (
                        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-end">
                            <div className="w-full sm:w-72">
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Dominio</label>
                                <input
                                    type="text"
                                    value={domainInput}
                                    onChange={e => setDomainInput(e.target.value)}
                                    placeholder="mail.tuodominio.it"
                                    className={inputCls}
                                />
                            </div>
                            <button
                                onClick={handleAddDomain}
                                disabled={isSubmittingDomain || !domainInput.trim()}
                                className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                            >
                                {isSubmittingDomain ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                                Collega dominio
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <span className="font-mono text-sm text-slate-700 dark:text-gray-200">{mailDomain.domain}</span>
                                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full ${statusBadge[mailDomain.status].classes}`}>
                                    {statusBadge[mailDomain.status].icon}
                                    {statusBadge[mailDomain.status].label}
                                </span>
                            </div>

                            {mailDomain.status !== 'verified' && (
                                <p className="text-xs text-slate-500 dark:text-gray-400">
                                    Aggiungi questi record DNS dal pannello di gestione del tuo dominio, poi premi "Verifica ora". La propagazione DNS può richiedere fino a qualche ora.
                                </p>
                            )}

                            {mailDomain.dns_records && mailDomain.dns_records.length > 0 && (
                                <div className="overflow-x-auto -mx-2">
                                    <table className="min-w-full text-xs">
                                        <thead>
                                            <tr className="text-left text-slate-400 dark:text-gray-500">
                                                <th className="px-2 py-1.5 font-medium">Tipo</th>
                                                <th className="px-2 py-1.5 font-medium">Nome</th>
                                                <th className="px-2 py-1.5 font-medium">Valore</th>
                                                <th className="px-2 py-1.5 font-medium">TTL</th>
                                                <th className="px-2 py-1.5 font-medium"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                            {mailDomain.dns_records.map((record, idx) => (
                                                <tr key={idx}>
                                                    <td className="px-2 py-1.5 font-mono whitespace-nowrap text-slate-700 dark:text-gray-200">{record.type}</td>
                                                    <td className="px-2 py-1.5 font-mono whitespace-nowrap text-slate-700 dark:text-gray-200 max-w-[180px] truncate" title={record.name}>{record.name}</td>
                                                    <td className="px-2 py-1.5 font-mono text-slate-700 dark:text-gray-200 max-w-[260px] truncate" title={record.value}>{record.value}</td>
                                                    <td className="px-2 py-1.5 font-mono whitespace-nowrap text-slate-500 dark:text-gray-400">{record.ttl || '—'}</td>
                                                    <td className="px-2 py-1.5">
                                                        <button
                                                            onClick={() => handleCopy(`${record.type}-${idx}`, record.value)}
                                                            title="Copia valore"
                                                            className="p-1 text-slate-400 hover:text-primary-500 rounded"
                                                        >
                                                            {copiedField === `${record.type}-${idx}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={handleVerifyDomain}
                                    disabled={isVerifying}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-medium rounded-lg transition-colors"
                                >
                                    {isVerifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                    Verifica ora
                                </button>
                                {!deleteConfirm ? (
                                    <button
                                        onClick={() => setDeleteConfirm(true)}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-red-500 hover:bg-red-500/10 text-xs font-medium rounded-lg transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                        Rimuovi dominio
                                    </button>
                                ) : (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-500 dark:text-gray-400">Confermi la rimozione?</span>
                                        <button onClick={handleDeleteDomain} className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md">Sì, rimuovi</button>
                                        <button onClick={() => setDeleteConfirm(false)} className="px-2 py-1 text-xs font-medium text-slate-600 dark:text-gray-300 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-md">Annulla</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'branding' && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Branding delle email</h3>
                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                            Logo, colori e footer che verranno usati in tutte le email di mail marketing.
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
                                        <input ref={logoInputRef} type="file" accept="image/*" onChange={handleLogoChange} className="hidden" id="mail-logo-upload-input" />
                                        <label htmlFor="mail-logo-upload-input" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg cursor-pointer transition-colors">
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
                                    placeholder={client?.name}
                                    className={inputCls}
                                />
                                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                                    Mostrato nell'intestazione delle email se non carichi un logo. Se vuoto verrà usato "{client?.name}".
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Nome mittente</label>
                                <input
                                    type="text"
                                    value={senderName}
                                    onChange={e => setSenderName(e.target.value)}
                                    placeholder={client?.name}
                                    className={inputCls}
                                />
                                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                                    Nome visualizzato come mittente, es. "{senderName || client?.name} &lt;noreply@{mailDomain?.domain || 'tuodominio.it'}&gt;".
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
                                    <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Colore secondario</label>
                                    <div className="mt-1 flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={branding.secondary_color || '#1e293b'}
                                            onChange={e => setBranding(prev => ({ ...prev, secondary_color: e.target.value }))}
                                            className="h-9 w-12 rounded-md border border-slate-300 dark:border-slate-600 cursor-pointer bg-transparent"
                                        />
                                        <span className="text-xs text-slate-500 dark:text-gray-400">{branding.secondary_color || '#1e293b'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Footer email</label>
                                <textarea
                                    value={branding.footer_text || ''}
                                    onChange={e => setBranding(prev => ({ ...prev, footer_text: e.target.value }))}
                                    placeholder={`${client?.name || ''} — Via Roma 1, Milano — P.IVA 00000000000`}
                                    rows={3}
                                    className={inputCls}
                                />
                                <p className="text-xs text-slate-400 dark:text-gray-500 mt-0.5">
                                    Mostrato in fondo a ogni email, insieme al link di disiscrizione.
                                </p>
                            </div>
                        </div>

                        {/* Anteprima */}
                        <div>
                            <label className="text-xs font-medium text-slate-500 dark:text-gray-400">Anteprima</label>
                            <div className="mt-1 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
                                <div className="p-4 text-center" style={{ backgroundColor: branding.secondary_color || '#1e293b' }}>
                                    {branding.logo_url ? (
                                        <img src={branding.logo_url} alt="Logo" className="h-10 mx-auto object-contain" />
                                    ) : (
                                        <span className="text-white font-semibold text-lg">{branding.brand_name || client?.name}</span>
                                    )}
                                </div>
                                <div className="p-4 bg-white dark:bg-slate-900 space-y-2">
                                    <h4 className="font-semibold" style={{ color: branding.primary_color || '#2563eb' }}>Titolo della campagna</h4>
                                    <p className="text-sm text-slate-600 dark:text-gray-300">Ciao Nome, ecco la nostra ultima novità...</p>
                                    <button
                                        className="text-sm font-medium px-3 py-1.5 rounded-md text-white"
                                        style={{ backgroundColor: branding.primary_color || '#2563eb' }}
                                    >
                                        Scopri di più
                                    </button>
                                </div>
                                <div className="p-3 bg-slate-50 dark:bg-slate-800 text-[11px] text-slate-400 dark:text-gray-500 whitespace-pre-line border-t border-slate-200 dark:border-slate-700">
                                    {branding.footer_text || `${client?.name || ''}`}
                                    {'\n'}Non vuoi più ricevere queste email? Disiscriviti
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-slate-200 dark:border-slate-700">
                        <button
                            onClick={handleSaveBranding}
                            disabled={isSavingBranding}
                            className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
                        >
                            {isSavingBranding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            Salva
                        </button>
                        {brandingSaved && <span className="text-sm text-green-600 dark:text-green-400">Salvato!</span>}
                    </div>
                </div>
            )}

            {activeTab === 'campagne' && (
                <div className="space-y-6">
                    {campaignsError && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{campaignsError}</div>
                    )}

                    {isCampaignsLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                        </div>
                    ) : (
                        <>
                            {/* Template */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Template email</h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                            Crea i template che potrai usare nelle tue campagne.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setTemplateModalState({ open: true, template: null })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Nuovo template
                                    </button>
                                </div>

                                {templates.length === 0 ? (
                                    <div className="text-center text-sm text-slate-400 py-6">
                                        Nessun template creato. Crea il tuo primo template per iniziare.
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                        {templates.map(tpl => (
                                            <button
                                                key={tpl.id}
                                                onClick={() => setTemplateModalState({ open: true, template: tpl })}
                                                className="text-left p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-primary-400 dark:hover:border-primary-500 transition-colors group"
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-700 dark:text-gray-200">
                                                        <FileText size={14} className="text-slate-400" />
                                                        {tpl.name}
                                                    </span>
                                                    <Pencil size={13} className="text-slate-300 group-hover:text-primary-500" />
                                                </div>
                                                <p className="text-xs text-slate-500 dark:text-gray-400 truncate">{tpl.subject_template || '—'}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Campagne */}
                            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Campagne</h3>
                                        <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                            Crea e invia campagne di mail marketing alle tue lead.
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => setCampaignModalState({ open: true, campaign: null })}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Nuova campagna
                                    </button>
                                </div>

                                {campaigns.length === 0 ? (
                                    <div className="text-center text-sm text-slate-400 py-6">
                                        Nessuna campagna creata.
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto -mx-2">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="text-left text-xs text-slate-400 dark:text-gray-500">
                                                    <th className="px-2 py-2 font-medium">Nome</th>
                                                    <th className="px-2 py-2 font-medium">Stato</th>
                                                    <th className="px-2 py-2 font-medium">Destinatari</th>
                                                    <th className="px-2 py-2 font-medium">Inviata il</th>
                                                    <th className="px-2 py-2 font-medium"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                                                {campaigns.map(camp => {
                                                    const counts = recipientCounts[camp.id];
                                                    return (
                                                        <tr key={camp.id} className="text-slate-700 dark:text-gray-200">
                                                            <td className="px-2 py-2">
                                                                <button onClick={() => setCampaignModalState({ open: true, campaign: camp })} className="font-medium hover:text-primary-500 text-left">
                                                                    {camp.name}
                                                                </button>
                                                                <div className="text-xs text-slate-400 dark:text-gray-500 truncate max-w-[220px]">{camp.subject}</div>
                                                            </td>
                                                            <td className="px-2 py-2">
                                                                <span className={`inline-flex items-center text-xs font-medium px-2 py-1 rounded-full ${campaignStatusBadge[camp.status].classes}`}>
                                                                    {campaignStatusBadge[camp.status].label}
                                                                </span>
                                                            </td>
                                                            <td className="px-2 py-2 text-xs">
                                                                {counts ? (
                                                                    <span>
                                                                        {counts.sent} inviate
                                                                        {counts.failed > 0 && <span className="text-red-500"> · {counts.failed} non riuscite</span>}
                                                                    </span>
                                                                ) : '—'}
                                                            </td>
                                                            <td className="px-2 py-2 text-xs whitespace-nowrap">
                                                                {camp.sent_at ? new Date(camp.sent_at).toLocaleString('it-IT') : '—'}
                                                            </td>
                                                            <td className="px-2 py-2 text-right">
                                                                {camp.status === 'draft' && (
                                                                    <button
                                                                        onClick={() => handleDeleteCampaign(camp.id)}
                                                                        title="Elimina campagna"
                                                                        className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </>
                    )}

                    {client && (
                        <>
                            <MailTemplateModal
                                isOpen={templateModalState.open}
                                onClose={() => setTemplateModalState({ open: false, template: null })}
                                template={templateModalState.template}
                                clientId={client.id}
                                clientName={client.name}
                                branding={branding}
                                onSaved={handleTemplateSaved}
                                onDeleted={handleTemplateDeleted}
                            />
                            <MailCampaignModal
                                isOpen={campaignModalState.open}
                                onClose={() => setCampaignModalState({ open: false, campaign: null })}
                                campaign={campaignModalState.campaign}
                                client={client}
                                templates={templates}
                                canSend={mailDomain?.status === 'verified'}
                                onSaved={handleCampaignSaved}
                            />
                        </>
                    )}
                </div>
            )}

            {activeTab === 'automazioni' && (
                <div className="space-y-6">
                    {automationsError && (
                        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-md p-3">{automationsError}</div>
                    )}

                    <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 border border-slate-100 dark:border-slate-700/50 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-semibold text-slate-700 dark:text-gray-200">Automazioni</h3>
                                <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">
                                    Invia automaticamente un'email quando una lead arriva o cambia stato, dopo un ritardo a tua scelta.
                                </p>
                            </div>
                            <button
                                onClick={() => setAutomationModalState({ open: true, automation: null })}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium rounded-lg transition-colors shrink-0"
                            >
                                <Plus className="w-3.5 h-3.5" /> Nuova automazione
                            </button>
                        </div>

                        {mailDomain?.status !== 'verified' && (
                            <div className="text-sm text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-md p-3">
                                Per attivare le automazioni devi prima collegare e verificare un dominio email nella tab "Dominio".
                            </div>
                        )}

                        {isAutomationsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
                            </div>
                        ) : automations.length === 0 ? (
                            <div className="text-center text-sm text-slate-400 py-6">
                                Nessuna automazione creata.
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {automations.map(auto => {
                                    const template = templates.find(t => t.id === auto.template_id);
                                    const triggerLabel = auto.trigger_type === 'lead_created'
                                        ? 'Nuova lead'
                                        : `Stato → ${auto.trigger_status}`;
                                    return (
                                        <div key={auto.id} className="flex flex-wrap items-center gap-3 p-3 rounded-lg border border-slate-200 dark:border-slate-700">
                                            <button
                                                onClick={() => setAutomationModalState({ open: true, automation: auto })}
                                                className="font-medium text-sm text-slate-700 dark:text-gray-200 hover:text-primary-500 text-left min-w-[140px]"
                                            >
                                                {auto.name}
                                            </button>
                                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-full">
                                                {triggerLabel}
                                                <ArrowRight size={12} />
                                                {auto.delay_hours === 0 ? 'subito' : `dopo ${auto.delay_hours}h`}
                                            </span>
                                            <span className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-gray-400">
                                                <FileText size={12} />
                                                {template?.name || '—'}
                                            </span>
                                            <div className="ml-auto flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleAutomation(auto)}
                                                    role="switch"
                                                    aria-checked={auto.active}
                                                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${auto.active ? 'bg-primary-600' : 'bg-slate-300 dark:bg-slate-600'}`}
                                                >
                                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${auto.active ? 'translate-x-4' : 'translate-x-1'}`} />
                                                </button>
                                                <button
                                                    onClick={() => setAutomationModalState({ open: true, automation: auto })}
                                                    title="Modifica"
                                                    className="p-1 text-slate-400 hover:text-primary-500 rounded"
                                                >
                                                    <Pencil size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteAutomation(auto.id)}
                                                    title="Elimina"
                                                    className="p-1 text-slate-400 hover:text-red-500 rounded"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {client && (
                        <MailAutomationModal
                            isOpen={automationModalState.open}
                            onClose={() => setAutomationModalState({ open: false, automation: null })}
                            automation={automationModalState.automation}
                            clientId={client.id}
                            templates={templates}
                            onSaved={handleAutomationSaved}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default MailMarketingPage;
