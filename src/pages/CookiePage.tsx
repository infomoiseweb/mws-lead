import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem' }}>{title}</h2>
        <div style={{ color: '#475569', lineHeight: 1.8, fontSize: '0.95rem' }}>{children}</div>
    </div>
);

const CookiePage: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Cookie Policy</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Ultimo aggiornamento: luglio 2025 &nbsp;|&nbsp; MWS Lead Manager
                    </p>
                </div>

                <Section title="1. Cosa sono i cookie">
                    <p>I cookie sono piccoli file di testo che vengono salvati sul dispositivo dell'utente quando visita un sito web. Servono a far funzionare il sito correttamente, a ricordare le preferenze dell'utente e, in alcuni casi, a raccogliere informazioni sull'utilizzo.</p>
                    <p style={{ marginTop: '0.5rem' }}>MWS Lead Manager utilizza tecnologie equivalenti come il <strong>localStorage</strong> del browser per salvare preferenze locali senza inviare dati a server esterni.</p>
                </Section>

                <Section title="2. Tipologie di cookie utilizzati">
                    <div style={{ overflowX: 'auto' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                                <tr style={{ backgroundColor: '#f1f5f9' }}>
                                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>Nome / Tipo</th>
                                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>Finalità</th>
                                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>Durata</th>
                                    <th style={{ padding: '0.6rem 0.75rem', textAlign: 'left', border: '1px solid #e2e8f0' }}>Consenso</th>
                                </tr>
                            </thead>
                            <tbody>
                                {[
                                    ['sb-* (Supabase)', 'Sessione autenticazione utente — mantiene il login attivo', 'Sessione / 7 giorni', 'Non richiesto (tecnico)'],
                                    ['mws_theme', 'Salva la preferenza tema chiaro/scuro (localStorage)', 'Permanente locale', 'Non richiesto (tecnico)'],
                                    ['mws_lang', 'Salva la lingua preferita dell\'interfaccia (localStorage)', 'Permanente locale', 'Non richiesto (tecnico)'],
                                    ['mws_cookie_consent', 'Ricorda che l\'utente ha accettato questa cookie policy', '12 mesi', 'Non richiesto (tecnico)'],
                                ].map(([nome, fin, dur, con], i) => (
                                    <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                                        <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0', fontWeight: 500 }}>{nome}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>{fin}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>{dur}</td>
                                        <td style={{ padding: '0.5rem 0.75rem', border: '1px solid #e2e8f0' }}>
                                            <span style={{ padding: '0.15rem 0.5rem', borderRadius: '999px', fontSize: '0.8rem', backgroundColor: '#dcfce7', color: '#166534' }}>{con}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <p style={{ marginTop: '0.75rem', padding: '0.75rem', backgroundColor: '#f0fdf4', borderRadius: '8px', borderLeft: '3px solid #22c55e', fontSize: '0.9rem' }}>
                        ✅ <strong>MWS Lead Manager non utilizza cookie pubblicitari, di profilazione o di tracciamento di terze parti.</strong> Non sono presenti pixel Meta, Google Analytics, o sistemi di remarketing.
                    </p>
                </Section>

                <Section title="3. Cookie di servizi terzi integrati">
                    <p>Quando l'utente collega servizi terzi opzionali, questi potrebbero impostare i propri cookie o token:</p>
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                        <li><strong>Google (Calendar):</strong> token OAuth salvato in modo sicuro nel database, non nel browser. Google potrebbe impostare cookie propri durante il flusso di autenticazione sul suo dominio.</li>
                        <li><strong>Meta (Facebook/Instagram):</strong> stessa modalità — token OAuth nel database. Meta gestisce i propri cookie durante il flusso OAuth sul suo dominio.</li>
                    </ul>
                    <p style={{ marginTop: '0.5rem' }}>Questi cookie di terze parti sono soggetti alle rispettive privacy policy di Google e Meta, non alla presente.</p>
                </Section>

                <Section title="4. Come gestire i cookie">
                    <p>Puoi controllare e cancellare i cookie tramite le impostazioni del tuo browser:</p>
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                        <li><a href="https://support.google.com/chrome/answer/95647" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Google Chrome</a></li>
                        <li><a href="https://support.mozilla.org/it/kb/protezione-antitracciamento-avanzata-firefox" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Mozilla Firefox</a></li>
                        <li><a href="https://support.apple.com/it-it/guide/safari/sfri11471/mac" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Safari</a></li>
                        <li><a href="https://support.microsoft.com/it-it/microsoft-edge/eliminare-i-cookie-in-microsoft-edge-63947406-40ac-c3b8-57b9-2a946a29ae09" target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6' }}>Microsoft Edge</a></li>
                    </ul>
                    <p style={{ marginTop: '0.75rem' }}>
                        Attenzione: disabilitando i cookie tecnici essenziali (come quelli di sessione Supabase), <strong>non sarà possibile effettuare il login</strong> alla piattaforma.
                    </p>
                </Section>

                <Section title="5. Base giuridica">
                    <p>I cookie tecnici essenziali non richiedono consenso ai sensi dell'Art. 122 del Codice Privacy italiano e della Direttiva ePrivacy (2002/58/CE), in quanto strettamente necessari per l'erogazione del servizio richiesto dall'utente.</p>
                    <p style={{ marginTop: '0.5rem' }}>Non utilizziamo cookie che richiedono consenso preventivo.</p>
                </Section>

                <Section title="6. Aggiornamenti alla Cookie Policy">
                    <p>Questa Cookie Policy può essere aggiornata per riflettere modifiche tecniche o normative. La data in cima alla pagina indica l'ultima revisione. Per modifiche sostanziali, gli utenti registrati saranno notificati via email.</p>
                </Section>

                <Section title="7. Contatti">
                    <p>Per domande su questa Cookie Policy o per esercitare i tuoi diritti:</p>
                    <p style={{ marginTop: '0.5rem' }}>
                        Email: <a href="mailto:info.moiseweb@gmail.com" style={{ color: '#3b82f6' }}>info.moiseweb@gmail.com</a>
                    </p>
                </Section>

                <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <p>MWS Lead Manager &copy; {new Date().getFullYear()} — Tutti i diritti riservati</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <a href="#/privacy" style={{ color: '#3b82f6', textDecoration: 'none' }}>Privacy Policy</a>
                        <span style={{ color: '#cbd5e1' }}>·</span>
                        <a href="#/termini" style={{ color: '#3b82f6', textDecoration: 'none' }}>Termini e Condizioni</a>
                        <span style={{ color: '#cbd5e1' }}>·</span>
                        <a href="mailto:info.moiseweb@gmail.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>info.moiseweb@gmail.com</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CookiePage;
