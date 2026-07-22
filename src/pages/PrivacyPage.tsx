import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem' }}>{title}</h2>
        <div style={{ color: '#475569', lineHeight: 1.8, fontSize: '0.95rem' }}>{children}</div>
    </div>
);

const PrivacyPage: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

                {/* Header */}
                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Informativa sulla Privacy</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Ultimo aggiornamento: luglio 2025 &nbsp;|&nbsp; MWS Lead Manager
                    </p>
                </div>

                <Section title="1. Titolare del trattamento">
                    <p>Il titolare del trattamento dei dati personali è:</p>
                    <p style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                        <strong>MWS Lead Manager</strong><br />
                        Email: <a href="mailto:ai.danielcorso@gmail.com" style={{ color: '#3b82f6' }}>ai.danielcorso@gmail.com</a><br />
                        Sito web: <a href="https://mws-saas.com" style={{ color: '#3b82f6' }}>https://mws-saas.com</a>
                    </p>
                </Section>

                <Section title="2. Dati raccolti">
                    <p>Raccogliamo e trattiamo le seguenti categorie di dati personali:</p>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        <li><strong>Dati di registrazione:</strong> nome, indirizzo email, password (cifrata)</li>
                        <li><strong>Dati di contatto dei lead:</strong> nome, numero di telefono, email, richieste specifiche forniti tramite form pubblici o API</li>
                        <li><strong>Dati di utilizzo:</strong> log di accesso, indirizzo IP, browser, azioni sull'applicazione</li>
                        <li><strong>Dati di integrazione:</strong> token OAuth di servizi terzi (Google Calendar, Meta) necessari per le funzionalità di sincronizzazione — non vengono mai condivisi con terze parti</li>
                        <li><strong>Dati commerciali:</strong> preventivi, appuntamenti, ricavi registrati dagli utenti</li>
                    </ul>
                </Section>

                <Section title="3. Finalità e base giuridica del trattamento">
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '0.5rem', fontSize: '0.9rem' }}>
                        <thead>
                            <tr style={{ backgroundColor: '#f1f5f9' }}>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>Finalità</th>
                                <th style={{ padding: '0.5rem 0.75rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>Base giuridica</th>
                            </tr>
                        </thead>
                        <tbody>
                            {[
                                ['Erogazione del servizio SaaS', 'Esecuzione contratto (Art. 6.1.b GDPR)'],
                                ['Autenticazione e sicurezza account', 'Legittimo interesse (Art. 6.1.f GDPR)'],
                                ['Invio notifiche di servizio', 'Esecuzione contratto (Art. 6.1.b GDPR)'],
                                ['Integrazione con servizi terzi (Google, Meta)', 'Consenso esplicito dell\'utente (Art. 6.1.a GDPR)'],
                                ['Adempimenti fiscali e legali', 'Obbligo legale (Art. 6.1.c GDPR)'],
                            ].map(([fin, base], i) => (
                                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                    <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>{fin}</td>
                                    <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>{base}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </Section>

                <Section title="4. Conservazione dei dati">
                    <p>I dati vengono conservati per il tempo strettamente necessario:</p>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        <li><strong>Dati account:</strong> per tutta la durata del rapporto contrattuale + 12 mesi dalla cancellazione</li>
                        <li><strong>Dati dei lead:</strong> per tutta la durata dell'account cliente + 24 mesi</li>
                        <li><strong>Log di accesso:</strong> 90 giorni</li>
                        <li><strong>Token OAuth:</strong> fino alla revoca esplicita dell'autorizzazione da parte dell'utente</li>
                        <li><strong>Dati fiscali:</strong> 10 anni per obbligo di legge</li>
                    </ul>
                </Section>

                <Section title="5. Condivisione con terze parti">
                    <p>I tuoi dati non vengono venduti né ceduti a terzi per finalità commerciali. Vengono condivisi esclusivamente con:</p>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        <li><strong>Supabase Inc.</strong> — infrastruttura database e autenticazione (hosting UE disponibile)</li>
                        <li><strong>Vercel Inc.</strong> — hosting e deployment dell'applicazione</li>
                        <li><strong>Google LLC</strong> — solo se l'utente collega Google Calendar (token gestito dall'utente)</li>
                        <li><strong>Meta Platforms Inc.</strong> — solo se l'utente collega i propri account social Meta (token gestito dall'utente)</li>
                        <li><strong>Resend Inc.</strong> — invio email transazionali</li>
                    </ul>
                    <p style={{ marginTop: '0.75rem' }}>Tutti i fornitori sono soggetti a contratti di trattamento dati (DPA) conformi al GDPR.</p>
                </Section>

                <Section title="6. Diritti dell'interessato (GDPR)">
                    <p>Ai sensi degli Artt. 15-22 del GDPR, hai il diritto di:</p>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        <li><strong>Accesso</strong> — richiedere una copia dei tuoi dati personali</li>
                        <li><strong>Rettifica</strong> — correggere dati inesatti o incompleti</li>
                        <li><strong>Cancellazione</strong> — richiedere la cancellazione dei tuoi dati ("diritto all'oblio")</li>
                        <li><strong>Portabilità</strong> — ricevere i tuoi dati in formato strutturato e leggibile</li>
                        <li><strong>Limitazione</strong> — limitare il trattamento in determinate circostanze</li>
                        <li><strong>Opposizione</strong> — opporti al trattamento basato su legittimo interesse</li>
                        <li><strong>Revoca del consenso</strong> — revocare in qualsiasi momento i consensi prestati</li>
                    </ul>
                    <p style={{ marginTop: '0.75rem' }}>
                        Per esercitare questi diritti, invia una richiesta a:{' '}
                        <a href="mailto:ai.danielcorso@gmail.com" style={{ color: '#3b82f6' }}>ai.danielcorso@gmail.com</a>.
                        Risponderemo entro 30 giorni. Hai inoltre il diritto di presentare reclamo all'
                        <a href="https://www.garanteprivacy.it" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Autorità Garante per la protezione dei dati personali</a>.
                    </p>
                </Section>

                <Section title="7. Cancellazione dei dati — Istruzioni">
                    <div id="cancellazione-dati" style={{ padding: '1rem', backgroundColor: '#fef3c7', borderRadius: '8px', borderLeft: '4px solid #f59e0b' }}>
                        <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Come richiedere la cancellazione dei tuoi dati:</p>
                        <ol style={{ paddingLeft: '1.25rem', marginBottom: '0.75rem' }}>
                            <li>Invia una email a <a href="mailto:ai.danielcorso@gmail.com" style={{ color: '#3b82f6' }}>ai.danielcorso@gmail.com</a> con oggetto: <strong>"Richiesta cancellazione dati"</strong></li>
                            <li>Indica il tuo indirizzo email associato all'account</li>
                            <li>Riceverai conferma entro 72 ore</li>
                            <li>La cancellazione completa avverrà entro 30 giorni dalla richiesta</li>
                        </ol>
                        <p style={{ fontSize: '0.85rem', color: '#92400e' }}>
                            Nota: alcuni dati potrebbero essere conservati per obblighi legali (es. fatturazione) anche dopo la cancellazione dell'account.
                        </p>
                    </div>
                    <p style={{ marginTop: '0.75rem' }}>
                        <strong>Se hai collegato Meta:</strong> puoi revocare l'accesso in qualsiasi momento dalle impostazioni della tua app Facebook su{' '}
                        <a href="https://www.facebook.com/settings?tab=applications" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>facebook.com/settings → App e siti web</a>.
                        La revoca rimuoverà immediatamente i token OAuth dal nostro sistema.
                    </p>
                </Section>

                <Section title="8. Cookie e tecnologie di tracciamento">
                    <p>MWS Lead Manager utilizza:</p>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        <li><strong>Cookie tecnici essenziali:</strong> necessari per il funzionamento dell'autenticazione e della sessione utente. Non richiedono consenso.</li>
                        <li><strong>LocalStorage:</strong> per salvare preferenze UI (tema, filtri) — nessun dato personale sensibile</li>
                        <li><strong>Nessun cookie di profilazione o pubblicitario</strong> di terze parti</li>
                    </ul>
                </Section>

                <Section title="9. Sicurezza dei dati">
                    <p>Adottiamo misure tecniche e organizzative adeguate per proteggere i tuoi dati:</p>
                    <ul style={{ marginTop: '0.5rem', paddingLeft: '1.25rem' }}>
                        <li>Cifratura TLS per tutti i dati in transito</li>
                        <li>Autenticazione tramite Supabase Auth con password cifrate (bcrypt)</li>
                        <li>Row Level Security (RLS) sul database — ogni utente accede solo ai propri dati</li>
                        <li>Token OAuth cifrati a riposo nel database</li>
                        <li>Accesso admin limitato al solo titolare</li>
                    </ul>
                </Section>

                <Section title="10. Trasferimenti internazionali">
                    <p>Alcuni fornitori (Supabase, Vercel, Google, Meta) possono conservare dati al di fuori dell'UE. In tali casi ci assicuriamo che esistano garanzie adeguate ai sensi dell'Art. 46 GDPR, incluse le Clausole Contrattuali Standard (SCC) approvate dalla Commissione Europea.</p>
                </Section>

                <Section title="11. Modifiche all'informativa">
                    <p>Questa informativa può essere aggiornata periodicamente. Le modifiche sostanziali verranno comunicate via email agli utenti registrati. La data in cima alla pagina indica l'ultima revisione.</p>
                </Section>

                {/* Footer */}
                <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <p>MWS Lead Manager &copy; {new Date().getFullYear()} — Tutti i diritti riservati</p>
                    <p style={{ marginTop: '0.25rem' }}>
                        <a href="mailto:ai.danielcorso@gmail.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>ai.danielcorso@gmail.com</a>
                        &nbsp;·&nbsp;
                        <a href="https://mws-saas.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>mws-saas.com</a>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default PrivacyPage;
