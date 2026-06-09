import React, { useState } from 'react';
import * as ApiService from '@api';
import type { Client } from '../types';
import { 
  Code, Copy, Check, CheckCircle2, Terminal, 
  Settings2, ExternalLink, FileCode, Sparkles, AlertCircle
} from 'lucide-react';

interface ClientIntegrationsProps {
  client: Client;
  onLeadAdded?: () => void;
}

export const ClientIntegrations: React.FC<ClientIntegrationsProps> = ({ client, onLeadAdded }) => {
  const [activeSubTab, setActiveSubTab] = useState<'wordpress' | 'html' | 'webhook'>('wordpress');
  const [copiedText, setCopiedText] = useState<string | null>(null);
  
  // Test lead form states
  const [testNome, setTestNome] = useState('');
  const [testEmail, setTestEmail] = useState('');
  const [testTelefono, setTestTelefono] = useState('');
  const [testService, setTestService] = useState(client.services[0]?.name || '');
  const [testNote, setTestNote] = useState('Lead di test inviato dal Portale Integrazione');
  
  const [testStatus, setTestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [testError, setTestError] = useState('');

  const endpointUrl = `${window.location.origin}/#/api/lead/${client.id}`;

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

  // Codice HTML generato dinamicamente con i servizi reali del cliente
  const htmlEmbedCode = `<!-- Modulo Contatti Modificabile per ${client.name} -->
<form action="${endpointUrl}" method="GET" style="max-width: 450px; margin: 20px auto; font-family: sans-serif; background: #fff; padding: 24px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); border: 1px solid #f0f0f0;">
  <h3 style="margin-top: 0; margin-bottom: 20px; color: #1e293b; text-align: center; font-size: 1.25rem;">Richiedi Servizio</h3>
  
  <div style="margin-bottom: 16px;">
    <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #475569;">Nome e Cognome *</label>
    <input type="text" name="nome" required placeholder="Es. Mario Rossi" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; outline: none;" />
  </div>

  <div style="margin-bottom: 16px;">
    <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #475569;">Indirizzo Email</label>
    <input type="email" name="email" placeholder="Es. mario@example.com" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;" />
  </div>

  <div style="margin-bottom: 16px;">
    <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #475569;">Numero Telefono *</label>
    <input type="tel" name="telefono" required placeholder="Es. 3471234567" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px;" />
  </div>

  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #475569;">Servizio Desiderato *</label>
    <select name="service" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; background: #fff;">
      ${client.services.map(s => `<option value="${s.name}">${s.name}</option>`).join('\n      ')}
    </select>
  </div>

  <div style="margin-bottom: 20px;">
    <label style="display: block; margin-bottom: 6px; font-size: 13px; font-weight: 600; color: #475569;">Messaggio o Note</label>
    <textarea name="note" placeholder="Descrivi brevemente la tua richiesta..." rows="3" style="width: 100%; box-sizing: border-box; padding: 10px; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 14px; resize: none;"></textarea>
  </div>

  <button type="submit" style="width: 100%; padding: 12px; background: #2563eb; color: #fff; font-size: 14px; font-weight: bold; border: none; border-radius: 6px; cursor: pointer; transition: background 0.2s;">
    Invia Richiesta
  </button>
</form>`;

  const webhookJsonSnippet = `{
  "nome": "Luca Rossi",
  "email": "luca@rossi.it",
  "telefono": "3331234567",
  "service": "${client.services[0]?.name || 'Generico'}",
  "note": "Richiesta preventivo inoltrata dal sistema"
}`;

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

        {/* Sub Tab Switcher */}
        <div className="flex border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <button
            onClick={() => setActiveSubTab('wordpress')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all ${
              activeSubTab === 'wordpress'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            WordPress / Elementor
          </button>
          <button
            onClick={() => setActiveSubTab('html')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all ${
              activeSubTab === 'html'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            Form HTML Personalizzato
          </button>
          <button
            onClick={() => setActiveSubTab('webhook')}
            className={`flex-1 py-4 text-center text-sm font-semibold border-b-2 transition-all ${
              activeSubTab === 'webhook'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-white dark:bg-slate-800'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            API webhook JSON
          </button>
        </div>

        <div className="p-6">
          {activeSubTab === 'wordpress' && (
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="bg-primary-100 dark:bg-primary-950/50 p-2 rounded-lg text-primary-600">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white">Passo 1: Copia URL Integrazione</h4>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">Usa questo URL unico per il tuo account cliente:</p>
                  
                  {/* Link copiatile */}
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

              <div className="flex items-start space-x-3 pt-2">
                <div className="bg-primary-100 dark:bg-primary-950/50 p-2 rounded-lg text-primary-600">
                  <CheckCircle2 size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-slate-800 dark:text-white">Passo 2: Mappa i Campi del Form</h4>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mt-1">
                    Nel tuo plugin preferito di WordPress (Elementor Forms, Contact Form 7, WPForms, Gravity Forms, ecc.), imposta un’azione dopo l'invio di tipo <strong>Webhook</strong> o <strong>Redirect</strong> all'URL fornito sopra.
                  </p>
                  <p className="text-sm text-slate-600 dark:text-gray-400 mt-2">
                    Assicurati che i nomi/chiavi (IDs) dei moduli corrispondano a questi elementi chiave:
                  </p>

                  <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded">
                      <span className="text-blue-500 font-bold">nome</span>: Nome contatto
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded">
                      <span className="text-blue-500 font-bold">email</span>: Indirizzo mail
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded">
                      <span className="text-blue-500 font-bold">telefono</span>: Cellulare
                    </div>
                    <div className="p-2 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 rounded">
                      <span className="text-blue-500 font-bold">service</span>: Nome servizio
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl mt-4">
                <div className="flex">
                  <AlertCircle className="text-amber-600 dark:text-amber-400 mr-2 flex-shrink-0" size={18} />
                  <div>
                    <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">💡 Consiglio dell'Amministratore</h5>
                    <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                      Puoi anche scegliere di far atterrare i lead sul tuo modulo di selezione servizio impostando il parametro <code className="bg-amber-100 dark:bg-amber-900 px-1 py-0.5 rounded text-amber-900 dark:text-white font-mono">service</code> statico all'interno dell'URL di tracciamento.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSubTab === 'html' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Incolla questo blocco di codice in una pagina HTML o in un widget personalizzato di qualsiasi CMS (Webflow, Shopify, WordPress) per visualizzare un modulo nativo ottimizzato.
              </p>

              <div className="relative">
                <div className="absolute right-3 top-3">
                  <button
                    onClick={() => triggerCopy(htmlEmbedCode, 'htmlembed')}
                    type="button"
                    className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md text-xs font-semibold text-slate-700 dark:text-white flex items-center space-x-1 transition"
                  >
                    {copiedText === 'htmlembed' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    <span>{copiedText === 'htmlembed' ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 dark:text-green-400 rounded-xl overflow-x-auto text-[11px] font-mono leading-relaxed h-72 border border-slate-800">
                  {htmlEmbedCode}
                </pre>
              </div>
            </div>
          )}

          {activeSubTab === 'webhook' && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-gray-400">
                Usa questo JSON payload per fare una chiamata REST di tipo <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-red-500 dark:text-red-400 font-mono text-xs">POST</code> o <code className="bg-slate-100 dark:bg-slate-900 px-1.5 py-0.5 rounded text-red-500 dark:text-red-400 font-mono text-xs">GET</code> dal tuo server o piattaforma (Zapier, Make, o codice backend custom).
              </p>

              <div className="p-4 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-850 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 dark:text-gray-400">ENDPOINT URL (POST/GET)</p>
                <div className="font-mono text-sm break-all font-bold text-slate-800 dark:text-white mt-1">
                  {endpointUrl}
                </div>
              </div>

              <div className="relative mt-2">
                <div className="absolute right-3 top-3">
                  <button
                    onClick={() => triggerCopy(webhookJsonSnippet, 'json')}
                    type="button"
                    className="p-1 px-2.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 rounded-md text-xs font-semibold text-slate-700 dark:text-white flex items-center space-x-1"
                  >
                    {copiedText === 'json' ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                    <span>{copiedText === 'json' ? 'Copiato!' : 'Copia'}</span>
                  </button>
                </div>
                <pre className="p-4 bg-slate-950 text-slate-200 dark:text-green-400 rounded-xl overflow-x-auto text-xs font-mono h-44">
                  {webhookJsonSnippet}
                </pre>
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
                {client.services.map(s => (
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
    </div>
  );
};
