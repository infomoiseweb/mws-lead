import React, { useMemo, useState, useEffect, useCallback } from 'react';
import * as ApiService from '@api';
import type { Client, Service, LeadField } from '../types';
import { isBaseService } from '@/utils/services';
import {
  Code, Copy, Check, CheckCircle2,
  ExternalLink, FileCode, Sparkles, AlertCircle, Globe, Tag, Settings, BookOpen
} from 'lucide-react';
import ServicesEditor, { type ServiceState } from './ServicesEditor';

interface ClientIntegrationsProps {
  client: Client;
  onLeadAdded?: () => void;
}

export const ClientIntegrations: React.FC<ClientIntegrationsProps> = ({ client, onLeadAdded }) => {
  const [activeSubTab, setActiveSubTab] = useState<'services' | 'manage' | 'guide' | 'token'>('services');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [expandedServiceId, setExpandedServiceId] = useState<string | null>(null);

  // Stato editor servizi self-service del cliente
  const [editableServices, setEditableServices] = useState<ServiceState[]>([]);
  const [isSavingServices, setIsSavingServices] = useState(false);
  const [servicesSaveError, setServicesSaveError] = useState('');
  const [servicesSaved, setServicesSaved] = useState(false);

  useEffect(() => {
    const rawServices = client.services || [];
    const baseService = rawServices.find(isBaseService);
    const baseServiceState: ServiceState = baseService ? {
      ...baseService,
      id: baseService.id || 'service_default_fields',
      name: baseService.name === '__default_fields__' ? 'Generale' : baseService.name,
      is_base: true,
      isExpanded: false,
      fields: (baseService.fields || []).map(f => ({ ...f, type: f.type || 'text' })),
    } : {
      id: 'service_default_fields',
      name: 'Generale',
      is_base: true,
      isExpanded: false,
      fields: [],
    };
    const otherServices = rawServices.filter(s => s.name !== '__lead_mode__' && !isBaseService(s));
    setEditableServices([
      baseServiceState,
      ...otherServices.map(s => ({ ...s, isExpanded: false, fields: (s.fields || []).map(f => ({ ...f, type: f.type || 'text' })) })),
    ]);
  }, [client.services]);

  const handleSaveServices = async () => {
    setIsSavingServices(true);
    setServicesSaveError('');
    try {
      const finalServices = editableServices
        .map(s => {
          if (!s || typeof s.name !== 'string' || s.name.trim() === '') return null;
          const { isExpanded, ...serviceForApi } = s;
          const validFields = (s.fields || []).filter(f => f && f.label?.trim() && f.name?.trim()).map(f =>
            f.options ? { ...f, options: f.options.map(opt => opt.trim()).filter(Boolean) } : f
          );
          return { ...serviceForApi, fields: validFields };
        })
        .filter(Boolean) as Service[];

      // Preserva l'entry __lead_mode__ esistente (modalità di default), se presente
      const existingLeadMode = (client.services || []).find((s: any) => s.name === '__lead_mode__');
      const mergedServices = existingLeadMode ? [existingLeadMode, ...finalServices] : finalServices;

      await ApiService.updateClient(client.id, { services: mergedServices });
      setServicesSaved(true);
      setTimeout(() => setServicesSaved(false), 2500);
      onLeadAdded?.();
    } catch (err: any) {
      setServicesSaveError(err.message || 'Errore durante il salvataggio.');
    } finally {
      setIsSavingServices(false);
    }
  };

  // Servizi reali del cliente (esclude il marker tecnico __default_fields__)
  const realServices = useMemo(
    () => client.services.filter(s => s.name !== '__default_fields__'),
    [client.services]
  );

  const defaultFields = useMemo(
    () => client.services.find(isBaseService)?.fields || [],
    [client.services]
  );

  // Test lead form states
  const [testNome, setTestNome] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testTelefono, setTestTelefono] = useState('');
  const [testService, setTestService] = useState(realServices[0]?.name || '');
  const [testNote, setTestNote] = useState('Lead di test inviato dal Portale Integrazione');

  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  // Gruppi di campi disponibili per la mappatura API/form (chiave tecnica da usare nel payload)
  const fieldGroups = useMemo(() => {
    const groups: { label: string; fields: { id: string; name: string; label: string }[] }[] = [];
    client.services.forEach(s => {
      if (!s.fields?.length) return;
      const label = s.name === '__default_fields__' ? 'Campi Base (sempre presenti)' : s.name;
      groups.push({ label, fields: s.fields });
    });
    return groups;
  }, [client.services]);

  const endpointUrl = `${window.location.origin}/#/api/lead/${client.id}`;
  const apiEndpointUrl = `${window.location.origin.replace('/#', '')}/api/leads`;
  const apiToken = client.api_token;

  const triggerCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleSendTestLead = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestStatus('loading');
    setTestError('');

    try {
      if (!testNome || !testTelefono) {
        throw new Error('Nome e Telefono sono campi obbligatori per il test.');
      }

      await ApiService.addLead({
        clientId: client.id,
        leadData: {
          nome: testNome,
          email: testEmail,
          telefono: testTelefono,
          note: testNote,
          ip_address: '127.0.0.1 (Modulo Test)',
          user_agent: 'Portale Integrazione Lead Hub'
        },
        service: testService || undefined
      });

      setTestStatus('success');
      // Reset form fields
      setTestNome('');
      setTestEmail('');
      setTestTelefono('');
      
      if (onLeadAdded) {
        onLeadAdded();
      }
    } catch (err: any) {
      setTestStatus('error');
      setTestError(err.message || "Impossibile inviare il lead di test.");
    }
  };

  // Renderizza un singolo campo come HTML per il modulo embeddabile
  const renderFieldHtml = (field: LeadField): string => {
    const requiredAttr = field.required ? ' required' : '';
    const labelHtml = `    <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #475569;">${field.label}${field.required ? ' *' : ''}</label>`;
    let inputHtml: string;

    switch (field.type) {
      case 'textarea':
        inputHtml = `    <textarea name="${field.name}"${requiredAttr} placeholder="" rows="3" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; resize: none;"></textarea>`;
        break;
      case 'select':
        inputHtml = `    <select name="${field.name}"${requiredAttr} style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: #fff;">\n${(field.options || []).map(o => `      <option value="${o}">${o}</option>`).join('\n')}\n    </select>`;
        break;
      case 'radio':
        return `  <div style="margin-bottom: 16px;">\n${labelHtml}\n${(field.options || []).map(o => `    <label style="margin-right: 12px; font-size: 14px; font-weight: normal;"><input type="radio" name="${field.name}" value="${o}"${requiredAttr} /> ${o}</label>`).join('\n')}\n  </div>`;
      case 'checkbox':
        return `  <div style="margin-bottom: 16px;">\n    <label style="font-size: 14px; font-weight: normal; display: flex; align-items: center; gap: 6px;"><input type="checkbox" name="${field.name}" value="si"${requiredAttr} /> ${field.label}${field.required ? ' *' : ''}</label>\n  </div>`;
      case 'file':
        inputHtml = `    <input type="file" name="${field.name}"${requiredAttr} style="width: 100%;" />`;
        break;
      default:
        inputHtml = `    <input type="${field.type}" name="${field.name}"${requiredAttr} placeholder="" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;" />`;
    }

    return `  <div style="margin-bottom: 16px;">\n${labelHtml}\n${inputHtml}\n  </div>`;
  };

  // Campi di un servizio: i suoi campi + i campi base ereditati (evita duplicati per il servizio base stesso)
  const getServiceFields = (service: Service | null): LeadField[] => {
    if (!service) return defaultFields;
    if (isBaseService(service)) return service.fields || [];
    return [...defaultFields, ...(service.fields || [])];
  };

  // Codice HTML generato dinamicamente per un servizio specifico (campi suoi + campi base ereditati)
  const buildHtmlEmbedCode = (service: Service | null): string => {
    const allFields = getServiceFields(service);
    const fieldsHtml = allFields.map(renderFieldHtml).join('\n\n');
    const title = service?.name || client.name;

    return `<!-- Modulo "${title}" per ${client.name} -->
<form action="${endpointUrl}" method="GET" style="max-width: 450px; margin: 20px auto; font-family: sans-serif; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #f0f0f0;">
  <h3 style="margin-top: 0; margin-bottom: 20px; color: #1e293b; text-align: center; font-size: 1.25rem;">${title}</h3>
${service ? `\n  <input type="hidden" name="service" value="${service.name}" />\n` : ''}
${fieldsHtml}

  <button type="submit" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; font-size: 14px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
    Invia Richiesta
  </button>
</form>`;
  };

  // Esempio JSON per l'invio via API per un servizio specifico (campi suoi + campi base ereditati)
  const buildApiJsonSnippet = (service: Service | null): string => {
    const allFields = getServiceFields(service);
    const sample: Record<string, string> = {};

    allFields.forEach(f => {
      if (f.type === 'email') sample[f.name] = 'mario@esempio.it';
      else if (f.type === 'tel') sample[f.name] = '3331234567';
      else if (f.name === 'nome') sample[f.name] = 'Mario Rossi';
      else sample[f.name] = `Valore ${f.label}`;
    });

    if (service) sample['service'] = service.name;

    return JSON.stringify(sample, null, 2);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:items-start anim-fade-in">
      {/* Colonna di Sinistra - Guide Interattive */}
      <div className="lg:col-span-7 bg-white dark:bg-slate-800 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform transition duration-300 hover:shadow-2xl">
        <div className="p-6 bg-gradient-to-r from-primary-600 to-indigo-600 text-white relative">
          <div className="absolute right-4 top-4 opacity-10">
            <Code size={120} />
          </div>
          <div className="flex items-center space-x-2">
            <span className="bg-white/20 text-xs text-white px-2.5 py-1 rounded-full uppercase tracking-wider font-semibold">
              Integrazione Autonoma
            </span>
          </div>
          <h2 className="text-2xl font-bold mt-2 text-white">Configura l'Arrivo Automatico dei Lead</h2>
          <p className="text-white/80 text-sm mt-1">Connetti qualsiasi sito WordPress, landing page, Facebook form o API custom.</p>
        </div>

        {/* Campi disponibili per la mappatura (chiavi tecniche da usare nel payload API/form) */}
        {fieldGroups.length > 0 && (
          <div className="p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
            <h4 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
              <FileCode size={16} className="text-primary-500" />
              Campi disponibili
            </h4>
            <p className="text-sm text-slate-600 dark:text-gray-400 mt-1 mb-3">
              Usa questi nomi chiave (non le etichette) come chiavi del payload quando invii lead via API o form. Clicca per copiare.
            </p>
            <div className="space-y-4">
              {fieldGroups.map(group => {
                const isBase = group.label === 'Campi Base (sempre presenti)';
                return (
                  <div key={group.label} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900">
                    <div className={`flex items-center gap-2 px-3 py-2 ${isBase ? 'bg-indigo-50 dark:bg-indigo-950/40' : 'bg-primary-50 dark:bg-primary-950/30'}`}>
                      {isBase ? (
                        <Sparkles size={14} className="text-indigo-500 shrink-0" />
                      ) : (
                        <Tag size={14} className="text-primary-500 shrink-0" />
                      )}
                      <span className={`text-xs font-bold uppercase tracking-wide ${isBase ? 'text-indigo-700 dark:text-indigo-300' : 'text-primary-700 dark:text-primary-300'}`}>
                        {group.label}
                      </span>
                      <span className="ml-auto text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/70 dark:bg-black/20 text-slate-500 dark:text-gray-400">
                        {group.fields.length} {group.fields.length === 1 ? 'campo' : 'campi'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3">
                      {group.fields.map(field => {
                        const copyId = `field-${group.label}-${field.name}`;
                        return (
                          <button
                            key={field.id || field.name}
                            type="button"
                            onClick={() => triggerCopy(field.name, copyId)}
                            title="Copia il nome chiave"
                            className="flex items-center justify-between gap-2 p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-left hover:border-primary-400 dark:hover:border-primary-600 transition"
                          >
                            <span className="min-w-0">
                              <span className="block text-xs text-slate-500 dark:text-gray-400 truncate">{field.label}</span>
                              <span className="block font-mono text-xs font-bold text-primary-600 dark:text-primary-400 truncate">{field.name}</span>
                            </span>
                            {copiedText === copyId ? (
                              <Check size={15} className="text-green-500 shrink-0" />
                            ) : (
                              <Copy size={15} className="text-slate-400 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sub Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveSubTab('services')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all ${
              activeSubTab === 'services'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Per Servizio
          </button>
          <button
            onClick={() => setActiveSubTab('manage')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'manage'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <Settings size={14} /> Gestisci Servizi
          </button>
          <button
            onClick={() => setActiveSubTab('token')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all ${
              activeSubTab === 'token'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Token API & Endpoint
          </button>
          <button
            onClick={() => setActiveSubTab('guide')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all flex items-center justify-center gap-1.5 ${
              activeSubTab === 'guide'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            <BookOpen size={14} /> Guida Make
          </button>
        </div>

        <div className="p-6">
          {activeSubTab === 'services' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Ogni servizio può ricevere le lead in modo indipendente: tramite un <strong>modulo HTML dedicato</strong> oppure via <strong>API</strong>. La modalità si configura in "Gestione Clienti".
              </p>

              {realServices.length === 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/50 flex items-center gap-2">
                    <Globe size={16} className="text-primary-500" />
                    <span className="font-semibold text-sm text-slate-800 dark:text-white">Modulo Generico (Campi Base)</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs text-slate-500 dark:text-gray-400">
                      Nessun servizio specifico configurato: usa questo modulo HTML basato sui campi base.
                    </p>
                    <div className="relative">
                      <div className="absolute right-3 top-3">
                        <button
                          onClick={() => triggerCopy(buildHtmlEmbedCode(null), 'html-generic')}
                          type="button"
                          className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md text-xs font-semibold text-slate-700 dark:text-white flex items-center space-x-1 transition"
                        >
                          {copiedText === 'html-generic' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                          <span>{copiedText === 'html-generic' ? 'Copiato!' : 'Copia'}</span>
                        </button>
                      </div>
                      <pre className="p-4 bg-slate-950 text-slate-200 dark:text-green-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed h-72 border border-slate-800">
                        {buildHtmlEmbedCode(null)}
                      </pre>
                    </div>
                  </div>
                </div>
              )}

              {realServices.map(service => {
                const isExpanded = expandedServiceId === service.id;
                const isApi = service.intake_mode === 'api';
                return (
                  <div key={service.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedServiceId(isExpanded ? null : service.id)}
                      className="w-full p-3 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between gap-2 text-left"
                    >
                      <span className="flex items-center gap-2">
                        <Tag size={16} className="text-primary-500" />
                        <span className="font-semibold text-sm text-slate-800 dark:text-white">{service.name}</span>
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${isApi ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'}`}>
                          {isApi ? 'API' : 'Form HTML'}
                        </span>
                      </span>
                      <ExternalLink size={14} className="text-slate-400" />
                    </button>

                    {isExpanded && (
                      <div className="p-4 space-y-3 bg-white dark:bg-slate-950/40">
                        {!isApi ? (
                          <>
                            <p className="text-xs text-slate-500 dark:text-gray-400">
                              Incolla questo modulo dedicato (campi del servizio + campi base, con il servizio già preimpostato) in una pagina HTML o widget di qualsiasi CMS.
                            </p>
                            <div className="relative">
                              <div className="absolute right-3 top-3">
                                <button
                                  onClick={() => triggerCopy(buildHtmlEmbedCode(service), `html-${service.id}`)}
                                  type="button"
                                  className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md text-xs font-semibold text-slate-700 dark:text-white flex items-center space-x-1 transition"
                                >
                                  {copiedText === `html-${service.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                  <span>{copiedText === `html-${service.id}` ? 'Copiato!' : 'Copia'}</span>
                                </button>
                              </div>
                              <pre className="p-4 bg-slate-950 text-slate-200 dark:text-green-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed h-72 border border-slate-800">
                                {buildHtmlEmbedCode(service)}
                              </pre>
                            </div>
                          </>
                        ) : (
                          <>
                            {/* Service name badge — copiabile con un click */}
                            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-800">
                              <div className="flex-1 min-w-0">
                                <p className="text-[11px] font-semibold text-primary-600 dark:text-primary-400 uppercase tracking-wide mb-0.5">Campo obbligatorio nel payload</p>
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-mono font-bold text-slate-700 dark:text-white">service</code>
                                  <span className="text-slate-400">→</span>
                                  <code className="text-sm font-mono font-bold text-primary-700 dark:text-primary-300 truncate">"{service.name}"</code>
                                </div>
                                <p className="text-[11px] text-slate-500 dark:text-gray-400 mt-1">Aggiungilo in Make/Zapier per assegnare la lead a questo servizio.</p>
                              </div>
                              <button
                                onClick={() => triggerCopy(`"service": "${service.name}"`, `service-name-${service.id}`)}
                                type="button"
                                title="Copia valore service"
                                className="flex-shrink-0 flex items-center gap-1.5 px-3 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-xs font-semibold transition"
                              >
                                {copiedText === `service-name-${service.id}` ? <Check size={13} className="text-green-300" /> : <Copy size={13} />}
                                {copiedText === `service-name-${service.id}` ? 'Copiato!' : 'Copia'}
                              </button>
                            </div>

                            <div className="relative">
                              <div className="absolute right-3 top-3">
                                <button
                                  onClick={() => triggerCopy(buildApiJsonSnippet(service), `json-${service.id}`)}
                                  type="button"
                                  className="p-1 px-2.5 bg-slate-700 hover:bg-slate-600 rounded-md text-xs font-semibold text-white flex items-center space-x-1"
                                >
                                  {copiedText === `json-${service.id}` ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                                  <span>{copiedText === `json-${service.id}` ? 'Copiato!' : 'Copia'}</span>
                                </button>
                              </div>
                              <pre className="p-4 bg-slate-950 text-green-400 rounded-xl overflow-x-auto text-xs font-mono">
{`// Header
Authorization: Bearer ${apiToken || '<api_token>'}
Content-Type: application/json

// Body
${buildApiJsonSnippet(service)}`}
                              </pre>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {activeSubTab === 'token' && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-primary-100 dark:bg-primary-950/50 p-2 rounded-lg text-primary-600">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white">URL Integrazione (redirect form GET)</h4>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">Usa questo URL unico per il tuo account cliente:</p>

                  <div className="mt-2 flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg font-mono text-xs text-slate-700 dark:text-gray-300">
                    <span className="truncate pr-4">{endpointUrl}</span>
                    <button
                      onClick={() => triggerCopy(endpointUrl, 'endpoint')}
                      type="button"
                      className="text-slate-400 hover:text-primary-500 dark:hover:text-primary-400 transition"
                      title="Copia"
                    >
                      {copiedText === 'endpoint' ? <Check size={16} className="text-green-500" /> : <Copy size={16} />}
                    </button>
                  </div>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-gray-400">
                Per le integrazioni via API, invia lead via <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-red-500 dark:text-red-400 font-mono text-xs">POST</code> all'endpoint qui sotto usando il tuo API Token univoco. Compatibile con Zapier, Make, n8n, o codice backend custom. Lo stesso token vale per tutti i servizi: usa il campo <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono">service</code> nel payload per indicare a quale servizio assegnare la lead.
              </p>

              {/* Endpoint URL */}
              <div className="p-3 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 mb-1">ENDPOINT (POST)</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs break-all text-slate-800 dark:text-white">{apiEndpointUrl}</span>
                  <button onClick={() => triggerCopy(apiEndpointUrl, 'apiurl')} type="button" className="shrink-0 text-slate-400 hover:text-primary-500 transition">
                    {copiedText === 'apiurl' ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                  </button>
                </div>
              </div>

              {/* API Token */}
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1 flex items-center gap-1.5">
                  <FileCode size={13} /> API TOKEN (segreto — non condividere)
                </p>
                {apiToken ? (
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs break-all text-amber-900 dark:text-amber-200 select-all">{apiToken}</span>
                    <button onClick={() => triggerCopy(apiToken, 'apitoken')} type="button" className="shrink-0 text-amber-500 hover:text-amber-700 dark:hover:text-amber-300 transition">
                      {copiedText === 'apitoken' ? <Check size={15} className="text-green-500" /> : <Copy size={15} />}
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-amber-600 dark:text-amber-400">Token non disponibile. Contatta l'admin.</p>
                )}
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl">
                <div className="flex">
                  <AlertCircle className="text-amber-600 dark:text-amber-400 mr-2 flex-shrink-0" size={18} />
                  <div>
                    <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">💡 Consiglio dell'Amministratore</h5>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Vai nella tab "Per Servizio" per ottenere il modulo HTML dedicato o l'esempio JSON specifico di ogni servizio.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'manage' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400 bg-emerald-50 dark:bg-slate-800/50 p-3 rounded-lg border border-emerald-100 dark:border-emerald-950/40">
                Crea, modifica o elimina i tuoi servizi e i campi che vuoi ricevere per ognuno. Il primo servizio è quello <strong>base</strong>: i suoi campi vengono inclusi automaticamente in tutti gli altri.
              </p>

              <ServicesEditor services={editableServices} onChange={setEditableServices} defaultIntakeMode="api" />

              {servicesSaveError && <p className="text-sm text-red-500 font-semibold">{servicesSaveError}</p>}

              <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700">
                <button
                  type="button"
                  onClick={handleSaveServices}
                  disabled={isSavingServices}
                  className="bg-primary-600 text-white font-bold px-5 py-2.5 rounded-lg shadow hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSavingServices ? 'Salvataggio...' : servicesSaved ? <><Check size={16} /> Salvato!</> : 'Salva Servizi'}
                </button>
              </div>
            </div>
          )}

          {activeSubTab === 'guide' && (
            <div className="space-y-5">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Guida passo-passo per collegare un modulo (es. Facebook Lead Ads, Typeform, Tilda) a questa piattaforma usando <strong>Make</strong> (ex Integromat), senza scrivere codice.
              </p>

              {[
                {
                  n: 1,
                  title: 'Crea uno scenario su Make',
                  body: 'Vai su make.com → "Create a new scenario". Scegli come primo modulo la tua sorgente lead (es. "Facebook Lead Ads → Watch Leads", oppure "Webhooks" se usi un form generico).',
                },
                {
                  n: 2,
                  title: 'Aggiungi un modulo HTTP',
                  body: 'Clicca il "+" dopo il primo modulo e cerca "HTTP". Scegli l\'azione "Make a request".',
                },
                {
                  n: 3,
                  title: 'Imposta URL e Metodo',
                  body: <>Incolla questo URL nel campo <strong>URL</strong> e imposta il <strong>Metodo</strong> su <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono text-xs">POST</code>:
                    <div className="mt-2 flex items-center justify-between gap-2 p-2.5 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg font-mono text-xs break-all">
                      <span>{apiEndpointUrl}</span>
                      <button onClick={() => triggerCopy(apiEndpointUrl, 'guide-url')} type="button" className="shrink-0 text-slate-400 hover:text-primary-500">
                        {copiedText === 'guide-url' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                      </button>
                    </div>
                  </>,
                },
                {
                  n: 4,
                  title: 'Aggiungi l\'header di autenticazione',
                  body: <>Nella sezione <strong>Headers</strong>, aggiungi una riga con Nome <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono text-xs">Authorization</code> e Valore <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono text-xs">Bearer {'<il_tuo_api_token>'}</code>:
                    {apiToken && (
                      <div className="mt-2 flex items-center justify-between gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg font-mono text-xs break-all">
                        <span>Bearer {apiToken}</span>
                        <button onClick={() => triggerCopy(`Bearer ${apiToken}`, 'guide-token')} type="button" className="shrink-0 text-amber-500 hover:text-amber-700">
                          {copiedText === 'guide-token' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    )}
                  </>,
                },
                {
                  n: 5,
                  title: 'Imposta il Body Type',
                  body: <>Imposta <strong>Body type</strong> su <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono text-xs">Raw</code> e <strong>Content type</strong> su <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono text-xs">JSON (application/json)</code>.</>,
                },
                {
                  n: 6,
                  title: 'Scrivi il Body (JSON) con i campi del servizio',
                  body: <>Vai nella tab <strong>"Per Servizio"</strong>, apri il servizio interessato e copia l'esempio JSON già pronto (con <code className="bg-slate-100 dark:bg-slate-900 px-1 rounded font-mono text-xs">service</code> già impostato). Incollalo nel campo Body e sostituisci i valori statici con le variabili del modulo precedente (es. trascina il campo "nome" di Facebook dentro al posto del valore "Mario Rossi").</>,
                },
                {
                  n: 7,
                  title: 'Esegui un test',
                  body: 'Clicca "Run once" in basso a sinistra su Make, poi fai arrivare una lead di prova (es. compila il form Facebook). Se tutto è corretto, lo stato HTTP risposta sarà 201 e la lead comparirà subito nella tua dashboard "I Miei Lead".',
                },
                {
                  n: 8,
                  title: 'Attiva lo scenario',
                  body: 'Una volta verificato che funziona, attiva lo scenario (interruttore in alto a sinistra su ON) e imposta la frequenza di esecuzione (es. "ogni 15 minuti" o "immediato" se disponibile per la tua sorgente).',
                },
              ].map(step => (
                <div key={step.n} className="flex gap-3 p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl">
                  <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary-600 text-white font-bold text-sm flex items-center justify-center">{step.n}</div>
                  <div className="min-w-0">
                    <h5 className="font-semibold text-sm text-slate-800 dark:text-white mb-1">{step.title}</h5>
                    <div className="text-xs text-slate-600 dark:text-gray-400 leading-relaxed">{step.body}</div>
                  </div>
                </div>
              ))}

              <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-900/50 rounded-xl flex gap-2">
                <AlertCircle className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" size={18} />
                <p className="text-xs text-indigo-700 dark:text-indigo-300">
                  Hai bisogno di campi diversi (es. "Targa veicolo", "Budget"...)? Vai in <strong>"Gestisci Servizi"</strong> per crearli tu stesso: ogni campo aggiunto qui apparirà automaticamente nell'esempio JSON da incollare su Make.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Colonna di Destra - Modulo di Invio Lead di Prova REALE */}
      <div className="lg:col-span-5 bg-white dark:bg-slate-800 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden transform transition duration-300 hover:shadow-2xl">
        <div className="p-6 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center space-x-2">
            <span className="p-1.5 bg-green-500/10 text-green-500 rounded-lg">
              <Sparkles size={18} />
            </span>
            <h3 className="font-bold text-lg text-slate-900 dark:text-white">Invia Lead di Test Realtime</h3>
          </div>
          <p className="text-xs text-slate-500 dark:text-gray-400 mt-1">
            Compila il modulo per testare instantaneamente l'integrazione. Apparirà nella tua scheda leads!
          </p>
        </div>

        <form onSubmit={handleSendTestLead} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1">
              Nome & Cognome *
            </label>
            <input
              type="text"
              required
              value={testNome}
              onChange={(e) => setTestNome(e.target.value)}
              placeholder="Es. Mario Rossi (Test)"
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                Telefono *
              </label>
              <input
                type="tel"
                required
                value={testTelefono}
                onChange={(e) => setTestTelefono(e.target.value)}
                placeholder="Es. 333889900"
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1">
                Servizio *
              </label>
              <select
                value={testService}
                onChange={(e) => setTestService(e.target.value)}
                className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
              >
                {realServices.map(s => (
                  <option key={s.id} value={s.name}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1">
              Opzionale: Mail
            </label>
            <input
              type="email"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              placeholder="Es. test@mail.it"
              className="w-full px-3 py-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-gray-400 uppercase tracking-wide mb-1">
              Messaggio Personalizzato
            </label>
            <textarea
              value={testNote}
              onChange={(e) => setTestNote(e.target.value)}
              rows={2}
              className="w-full p-2 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-sans"
            />
          </div>

          {testStatus === 'success' && (
            <div className="p-3 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900 rounded-lg flex items-center space-x-2 text-green-700 dark:text-green-300 text-xs">
              <CheckCircle2 size={16} />
              <span><strong>Successo!</strong> Lead aggiunto. Controlla la tua dashboard!</span>
            </div>
          )}

          {testStatus === 'error' && (
            <div className="p-3 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-center space-x-2 text-red-700 dark:text-red-300 text-xs">
              <AlertCircle size={16} />
              <span>{testError}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={testStatus === 'loading'}
            className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white hover:shadow-lg font-bold rounded-lg tracking-wide transition-all uppercase text-xs disabled:opacity-50"
          >
            {testStatus === 'loading' ? 'Registrazione in corso...' : 'Invia un Lead di Prova Realtime'}
          </button>
        </form>
      </div>

      {/* Google Calendar */}
      <div className="lg:col-span-12 bg-white dark:bg-slate-800 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
              {/* Google Calendar icon */}
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
            </div>
            <div>
              <h3 className="font-bold text-slate-800 dark:text-white text-base">Google Calendar</h3>
              {client.google_calendar_enabled ? (
                <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-0.5">
                  ✅ Collegato — gli appuntamenti si sincronizzano automaticamente
                </p>
              ) : (
                <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                  Collega il tuo account Google per sincronizzare gli appuntamenti in automatico
                </p>
              )}
            </div>
          </div>
          <a
            href={`/api/google-calendar?client_id=${client.id}&redirect_to=client`}
            className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
              client.google_calendar_enabled
                ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-gray-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                : 'bg-primary-600 text-white hover:bg-primary-700'
            }`}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill={client.google_calendar_enabled ? '#4285F4' : 'white'}/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill={client.google_calendar_enabled ? '#34A853' : 'white'}/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill={client.google_calendar_enabled ? '#FBBC05' : 'white'}/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill={client.google_calendar_enabled ? '#EA4335' : 'white'}/>
            </svg>
            {client.google_calendar_enabled ? 'Ricollega account' : 'Collega Google Calendar'}
          </a>
        </div>
      </div>

      {/* ── Meta Social — solo se abilitato dall'admin ── */}
      {client.meta_enabled && (
        <>
          {/* Card Facebook */}
          <div className="lg:col-span-12 bg-white dark:bg-slate-800 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="p-6 flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#1877F2"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-base">Facebook</h3>
                  {client.meta_access_token ? (
                    <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-0.5">
                      ✅ Collegato — {(client.meta_pages as any[] || []).length} pagina/e disponibile/i
                    </p>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                      Collega il tuo account Facebook per pubblicare post sulle tue pagine
                    </p>
                  )}
                </div>
              </div>
              <a
                href={`/api/meta?client_id=${client.id}&redirect_to=client`}
                className={`flex-shrink-0 flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all shadow-sm ${
                  client.meta_access_token
                    ? 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-gray-200 hover:bg-slate-200 dark:hover:bg-slate-600'
                    : 'bg-[#1877F2] text-white hover:bg-[#166FE5]'
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                {client.meta_access_token ? 'Ricollega' : 'Collega Facebook'}
              </a>
            </div>
            {client.meta_access_token && (client.meta_pages as any[] || []).length > 0 && (
              <div className="px-6 pb-4 border-t border-slate-100 dark:border-slate-700 pt-4">
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide mb-2">Pagine collegate</p>
                <div className="flex flex-wrap gap-2">
                  {(client.meta_pages as any[]).map((page: any) => (
                    <span key={page.id} className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-xs font-medium">
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      {page.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Card Instagram — appare solo dopo aver collegato Facebook */}
          {client.meta_access_token && (
            <div className="lg:col-span-12 bg-white dark:bg-slate-800 shadow-xl rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="p-6 flex flex-col sm:flex-row sm:items-start gap-4">
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%)' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-bold text-slate-800 dark:text-white text-base">Instagram</h3>
                    {client.meta_instagram_active ? (
                      <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-0.5">
                        ✅ Collegato — account dalla pagina "{(client.meta_instagram_active as any).page_name}"
                      </p>
                    ) : (client.meta_instagram_accounts as any[] || []).length > 0 ? (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-0.5">
                        Seleziona quale account Instagram vuoi usare per pubblicare
                      </p>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-gray-400 mt-0.5">
                        Nessun account Instagram Business trovato. Assicurati che la tua pagina Facebook sia collegata a un account Instagram Business.
                      </p>
                    )}
                    {/* Selettore account Instagram */}
                    {(client.meta_instagram_accounts as any[] || []).length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(client.meta_instagram_accounts as any[]).map((acc: any) => {
                          const isActive = (client.meta_instagram_active as any)?.id === acc.id;
                          return (
                            <button
                              key={acc.id}
                              onClick={async () => {
                                const { data: { session } } = await (await import('../../lib/supabase')).supabase.auth.getSession();
                                await fetch('/api/meta', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                                  body: JSON.stringify({ action: 'set_instagram_account', client_id: client.id, instagram_account: isActive ? null : acc }),
                                });
                                window.location.reload();
                              }}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                isActive
                                  ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-300 border-pink-300 dark:border-pink-700'
                                  : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-gray-300 border-slate-200 dark:border-slate-600 hover:border-pink-400'
                              }`}
                            >
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
                              {acc.page_name} {isActive && '✓'}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
