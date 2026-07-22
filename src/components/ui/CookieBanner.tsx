import React, { useState, useEffect } from 'react';

const COOKIE_KEY = 'mws_cookie_consent';

const CookieBanner: React.FC = () => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!localStorage.getItem(COOKIE_KEY)) {
            setVisible(true);
        }
    }, []);

    const accept = () => {
        localStorage.setItem(COOKIE_KEY, 'accepted');
        setVisible(false);
    };

    if (!visible) return null;

    return (
        <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
            backgroundColor: '#0f172a', borderTop: '1px solid rgba(255,255,255,0.1)',
            padding: '1rem 1.5rem',
            display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between',
            gap: '0.75rem',
            boxShadow: '0 -4px 20px rgba(0,0,0,0.4)',
        }}>
            <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: '0.875rem', margin: 0, flex: '1 1 300px' }}>
                Utilizziamo cookie tecnici essenziali per il funzionamento della piattaforma. Non usiamo cookie pubblicitari o di profilazione.{' '}
                <a href="#/cookie" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Cookie Policy</a>
                {' '}·{' '}
                <a href="#/privacy" style={{ color: '#60a5fa', textDecoration: 'underline' }}>Privacy Policy</a>
            </p>
            <button
                onClick={accept}
                style={{
                    backgroundColor: '#3b82f6', color: '#fff',
                    border: 'none', borderRadius: '8px',
                    padding: '0.5rem 1.25rem', fontSize: '0.875rem', fontWeight: 600,
                    cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                }}
            >
                Ho capito
            </button>
        </div>
    );
};

export default CookieBanner;
