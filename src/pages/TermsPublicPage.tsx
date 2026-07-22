import React from 'react';

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div style={{ marginBottom: '2rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.75rem', color: '#1e293b', borderBottom: '2px solid #e2e8f0', paddingBottom: '0.4rem' }}>{title}</h2>
        <div style={{ color: '#475569', lineHeight: 1.8, fontSize: '0.95rem' }}>{children}</div>
    </div>
);

const TermsPublicPage: React.FC = () => {
    return (
        <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '2rem 1rem' }}>
            <div style={{ maxWidth: '800px', margin: '0 auto', backgroundColor: '#fff', borderRadius: '12px', padding: '2.5rem', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>

                <div style={{ marginBottom: '2.5rem', textAlign: 'center' }}>
                    <h1 style={{ fontSize: '2rem', fontWeight: 800, color: '#0f172a', marginBottom: '0.5rem' }}>Termini e Condizioni</h1>
                    <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
                        Ultimo aggiornamento: luglio 2025 &nbsp;|&nbsp; MWS Lead Manager
                    </p>
                </div>

                <Section title="1. Accettazione dei termini">
                    <p>Accedendo e utilizzando MWS Lead Manager ("il Servizio"), l'utente accetta integralmente i presenti Termini e Condizioni. Se non accetti queste condizioni, non utilizzare il Servizio. L'uso continuato del Servizio dopo eventuali modifiche ai Termini costituisce accettazione delle stesse.</p>
                </Section>

                <Section title="2. Descrizione del servizio">
                    <p>MWS Lead Manager è una piattaforma SaaS (Software as a Service) B2B che consente la gestione di lead pubblicitari, la creazione di preventivi, la pianificazione di appuntamenti e il monitoraggio delle performance commerciali.</p>
                    <p style={{ marginTop: '0.5rem' }}>Il Servizio è fornito da:</p>
                    <p style={{ marginTop: '0.5rem', padding: '0.75rem 1rem', backgroundColor: '#f1f5f9', borderRadius: '8px' }}>
                        <strong>MWS Lead Manager / Moise Web Srl</strong><br />
                        HQ: Oradea, Romania &nbsp;|&nbsp; P.IVA: RO50469659<br />
                        Email: <a href="mailto:info.moiseweb@gmail.com" style={{ color: '#3b82f6' }}>info.moiseweb@gmail.com</a><br />
                        Sito: <a href="https://mws-saas.com" style={{ color: '#3b82f6' }}>https://mws-saas.com</a>
                    </p>
                </Section>

                <Section title="3. Accesso e account">
                    <ul style={{ paddingLeft: '1.25rem' }}>
                        <li>L'accesso al Servizio avviene tramite credenziali fornite dall'amministratore della piattaforma.</li>
                        <li>L'utente è responsabile della riservatezza delle proprie credenziali e di tutte le attività svolte tramite il proprio account.</li>
                        <li>In caso di accesso non autorizzato, l'utente deve notificare immediatamente il fornitore.</li>
                        <li>Il fornitore si riserva il diritto di sospendere o chiudere account in caso di violazione dei presenti Termini.</li>
                    </ul>
                </Section>

                <Section title="4. Uso consentito">
                    <p>Il Servizio può essere utilizzato esclusivamente per finalità lecite e conformi alle normative vigenti. È vietato:</p>
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                        <li>Utilizzare il Servizio per attività illegali, fraudolente o lesive di diritti di terzi</li>
                        <li>Tentare di accedere a sezioni non autorizzate della piattaforma</li>
                        <li>Raccogliere dati di altri utenti senza consenso</li>
                        <li>Interferire con il funzionamento del Servizio o dei suoi server</li>
                        <li>Caricare contenuti che violino diritti di proprietà intellettuale</li>
                        <li>Rivendere o sublicenziare l'accesso al Servizio a terzi</li>
                    </ul>
                </Section>

                <Section title="5. Dati e contenuti dell'utente">
                    <p>L'utente rimane proprietario di tutti i dati inseriti nel Servizio (lead, preventivi, appuntamenti, ecc.). Concede al fornitore una licenza limitata, non esclusiva, necessaria esclusivamente per erogare il Servizio.</p>
                    <p style={{ marginTop: '0.5rem' }}>Il fornitore non utilizzerà i dati dell'utente per finalità diverse dall'erogazione del Servizio. Per dettagli sul trattamento dei dati, consultare la <a href="#/privacy" style={{ color: '#3b82f6' }}>Privacy Policy</a>.</p>
                </Section>

                <Section title="6. Disponibilità del servizio">
                    <p>Il fornitore si impegna a garantire la massima disponibilità del Servizio, ma non può garantire un'operatività ininterrotta al 100%. Possono verificarsi interruzioni per:</p>
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                        <li>Manutenzione programmata (comunicata con anticipo)</li>
                        <li>Guasti tecnici imprevisti</li>
                        <li>Cause di forza maggiore</li>
                    </ul>
                    <p style={{ marginTop: '0.5rem' }}>Il fornitore non è responsabile per danni derivanti da interruzioni del servizio.</p>
                </Section>

                <Section title="7. Limitazione di responsabilità">
                    <p>Nei limiti consentiti dalla legge applicabile, il fornitore non è responsabile per:</p>
                    <ul style={{ paddingLeft: '1.25rem', marginTop: '0.5rem' }}>
                        <li>Danni indiretti, incidentali o consequenziali derivanti dall'uso del Servizio</li>
                        <li>Perdita di dati causata da comportamenti dell'utente o da eventi fuori dal controllo del fornitore</li>
                        <li>Decisioni commerciali prese dall'utente sulla base delle informazioni gestite nel Servizio</li>
                        <li>Malfunzionamenti di servizi terzi integrati (Google Calendar, Meta, ecc.)</li>
                    </ul>
                </Section>

                <Section title="8. Proprietà intellettuale">
                    <p>Tutti i diritti di proprietà intellettuale relativi al Servizio (software, design, marchi, loghi) appartengono al fornitore o ai suoi licenziatari. È vietata qualsiasi riproduzione, distribuzione o modifica senza autorizzazione scritta.</p>
                </Section>

                <Section title="9. Modifiche al servizio e ai termini">
                    <p>Il fornitore si riserva il diritto di modificare, sospendere o interrompere il Servizio in qualsiasi momento, con o senza preavviso. Le modifiche sostanziali ai presenti Termini saranno comunicate via email con almeno 15 giorni di anticipo.</p>
                </Section>

                <Section title="10. Legge applicabile e foro competente">
                    <p>I presenti Termini sono regolati dalla legge italiana e dalla normativa dell'Unione Europea applicabile. Per qualsiasi controversia, le parti tenteranno in primo luogo una risoluzione amichevole. In mancanza, il foro competente è quello di <strong>Milano (Italia)</strong>.</p>
                </Section>

                <Section title="11. Contatti">
                    <p>Per qualsiasi domanda sui presenti Termini:</p>
                    <p style={{ marginTop: '0.5rem' }}>
                        Email: <a href="mailto:info.moiseweb@gmail.com" style={{ color: '#3b82f6' }}>info.moiseweb@gmail.com</a>
                    </p>
                </Section>

                <div style={{ marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px solid #e2e8f0', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>
                    <p>MWS Lead Manager &copy; {new Date().getFullYear()} — Tutti i diritti riservati</p>
                    <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        <a href="#/privacy" style={{ color: '#3b82f6', textDecoration: 'none' }}>Privacy Policy</a>
                        <span style={{ color: '#cbd5e1' }}>·</span>
                        <a href="#/cookie" style={{ color: '#3b82f6', textDecoration: 'none' }}>Cookie Policy</a>
                        <span style={{ color: '#cbd5e1' }}>·</span>
                        <a href="mailto:info.moiseweb@gmail.com" style={{ color: '#3b82f6', textDecoration: 'none' }}>info.moiseweb@gmail.com</a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TermsPublicPage;
