import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Lock, Mail, Sparkles, KeyRound, ArrowLeft, RefreshCw, AlertCircle, Eye, EyeOff, ShieldCheck, BarChart3, MessageCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';
import './LoginPage.css';

interface FloatingFieldProps {
    id: string;
    type: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    label: string;
    icon: React.ReactNode;
    autoComplete?: string;
    required?: boolean;
    rightElement?: React.ReactNode;
}

const FloatingField: React.FC<FloatingFieldProps> = ({ id, type, value, onChange, label, icon, autoComplete, required, rightElement }) => (
    <div className={`login-field ${value ? 'filled' : ''}`}>
        <input
            id={id}
            name={id}
            type={type}
            autoComplete={autoComplete}
            required={required}
            value={value}
            onChange={onChange}
            placeholder={label}
        />
        <span className="login-field-icon">{icon}</span>
        <label htmlFor={id}>{label}</label>
        <span className="login-field-line"></span>
        {rightElement}
    </div>
);

const LoginPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login, forgotPassword } = useAuth();

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Forgot password states
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');

    // Reset password states (if routed from email link)
    const [isResetMode, setIsResetMode] = useState(false);
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);

    useEffect(() => {
        // Controlla se siamo in modalità reset password (es. link mail)
        if (searchParams.get('reset') === 'true' || window.location.href.includes('type=recovery')) {
            setIsResetMode(true);
        }
    }, [searchParams]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            const user = await login(email, password);
            if (user) {
                if (user.role === 'admin') {
                    navigate('/admin/overview');
                } else {
                    navigate(`/client/${user.id}/overview`);
                }
            } else {
                setError(t('login_error_credentials') || 'Credenziali non valide o utente non trovato.');
            }
        } catch (err: any) {
            if (err instanceof Error) {
                if (err.message.includes("sospeso") || err.message.includes("suspended")) {
                    setError(t('login_error_suspended') || 'Questo account è stato sospeso.');
                } else {
                    setError(err.message);
                }
            } else {
                setError(t('login_error_generic') || 'Errore imprevisto durante il login.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleForgotPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        setIsLoading(true);

        try {
            await forgotPassword(forgotEmail);
            setSuccess('Un link di recupero è stato inviato alla tua email. Controlla la tua casella postale!');
            setForgotEmail('');
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'invio dell\'email di recupero.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        if (!newPassword || newPassword.length < 12) {
            setError('La password deve contenere almeno 12 caratteri.');
            return;
        }
        setIsLoading(true);

        try {
            const { error } = await supabase.auth.updateUser({ password: newPassword });
            if (error) throw error;

            setSuccess('La tua password è stata aggiornata con successo! Ora puoi effettuare il login.');
            setTimeout(() => {
                setIsResetMode(false);
                setNewPassword('');
            }, 3000);
        } catch (err: any) {
            setError(err.message || 'Errore durante l\'aggiornamento della password.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex flex-col bg-[#101e33] text-white relative overflow-hidden font-sans">
            {/* Sfondo animato: blob + griglia */}
            <div className="login-bg-shapes">
                <div className="login-blob login-blob-1"></div>
                <div className="login-blob login-blob-2"></div>
                <div className="login-blob login-blob-3"></div>
                <div className="login-blob login-blob-4"></div>
                <div className="login-grid"></div>
            </div>

            <main className="flex-grow flex items-center justify-center p-4 z-10">
                <div className="login-shell w-full max-w-5xl grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] rounded-2xl overflow-hidden border border-white/10 shadow-[0_25px_60px_-12px_rgba(0,0,0,0.6)]">

                    {/* Pannello sinistro: copy + logo */}
                    <div className="hidden lg:flex flex-col justify-between p-10 bg-white/[0.03] backdrop-blur-xl border-r border-white/10 relative">
                        <div>
                            <div className="flex items-center gap-3 mb-10">
                                <img
                                    src="https://moise-web-srl.com/wp-content/uploads/2025/07/web-app-manifest-512x512-2.png"
                                    alt="MWS Lead Hub Logo"
                                    className="h-32 w-32 object-contain filter drop-shadow-[0_10px_15px_rgba(96,165,250,0.35)]"
                                />
                                <span className="login-3d-text text-3xl font-extrabold tracking-tight text-white">MWS Lead Hub</span>
                            </div>

                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-[#9cc9ff] mb-6">
                                <Sparkles className="w-3.5 h-3.5" /> Beta
                            </div>

                            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white via-[#dbeafe] to-[#c4b5fd]">
                                Tutte le tue lead, sempre sotto controllo.
                            </h1>
                            <p className="text-white/60 text-sm leading-relaxed max-w-md">
                                Gestisci campagne, contatti e preventivi dei tuoi clienti in un'unica dashboard:
                                monitora ogni lead dal primo contatto alla chiusura, traccia il ROI delle tue
                                campagne pubblicitarie e mantieni tutto organizzato in tempo reale.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mt-10">
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                                <ShieldCheck className="w-5 h-5 text-[#5eead4] mb-2" />
                                <div className="text-sm font-semibold text-white">Accesso sicuro</div>
                                <div className="text-xs text-white/50 mt-1">Dati protetti e cifrati</div>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                                <BarChart3 className="w-5 h-5 text-[#60a5fa] mb-2" />
                                <div className="text-sm font-semibold text-white">ROI in tempo reale</div>
                                <div className="text-xs text-white/50 mt-1">Spese vs risultati</div>
                            </div>
                            <div className="rounded-xl bg-white/[0.04] border border-white/10 p-4">
                                <MessageCircle className="w-5 h-5 text-[#a78bfa] mb-2" />
                                <div className="text-sm font-semibold text-white">Contatti rapidi</div>
                                <div className="text-xs text-white/50 mt-1">WhatsApp & email</div>
                            </div>
                        </div>
                    </div>

                    {/* Pannello destro: form */}
                    <div className="p-8 sm:p-10 bg-white/[0.05] backdrop-blur-xl flex flex-col justify-center">
                        <div className="text-center lg:text-left mb-8">
                            <div className="lg:hidden flex justify-center mb-6">
                                <div className="relative inline-block">
                                    <img
                                        src="https://moise-web-srl.com/wp-content/uploads/2025/07/web-app-manifest-512x512-2.png"
                                        alt="MWS Lead Hub Logo"
                                        className="mx-auto h-28 w-28 object-contain filter drop-shadow-[0_10px_15px_rgba(96,165,250,0.35)]"
                                    />
                                    <div className="absolute bottom-1 right-1 bg-[#5eead4] text-[10px] uppercase font-bold text-slate-900 px-1 py-0.5 rounded shadow-lg flex items-center gap-1">
                                        <Sparkles className="w-2.5 h-2.5" /> Beta
                                    </div>
                                </div>
                            </div>

                            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
                                {isResetMode ? 'Nuova password' : showForgot ? 'Recupera password' : 'Accedi al tuo account'}
                            </h2>
                            <p className="mt-2 text-sm text-white/60">
                                {isResetMode
                                    ? 'Imposta la tua nuova credenziale di accesso.'
                                    : showForgot
                                        ? 'Inserisci la tua email per ricevere il link di ripristino.'
                                        : t('login_subtitle') || 'Accedi alla console di gestione lead multi-tenant.'}
                            </p>
                        </div>

                        {isResetMode ? (
                            /* MODALITÀ RESET PASSWORD */
                            <form className="space-y-5" onSubmit={handleResetPassword}>
                                <FloatingField
                                    id="newPassword"
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    label="Nuova password (min. 12 caratteri)"
                                    icon={<KeyRound className="h-5 w-5" />}
                                    required
                                    rightElement={
                                        <button type="button" className="login-toggle-password" onClick={() => setShowNewPassword(v => !v)} aria-label="Mostra/nascondi password">
                                            {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    }
                                />

                                {error && (
                                    <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-300">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {success && (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-sm text-emerald-300">
                                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                                        <span>{success}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="login-submit-btn w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#101e33] focus:ring-[#60a5fa] disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(96,165,250,0.3)]"
                                >
                                    <span className="login-btn-glow"></span>
                                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Ripristina password'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setIsResetMode(false)}
                                    className="w-full text-center text-sm font-medium text-[#9cc9ff] hover:text-white transition-colors"
                                >
                                    Torna al login
                                </button>
                            </form>

                        ) : showForgot ? (
                            /* MODALITÀ FORGOT PASSWORD */
                            <form className="space-y-5" onSubmit={handleForgotPassword}>
                                <FloatingField
                                    id="forgotEmail"
                                    type="email"
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    label="Indirizzo email"
                                    icon={<Mail className="h-5 w-5" />}
                                    autoComplete="email"
                                    required
                                />

                                {error && (
                                    <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-300">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                {success && (
                                    <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-sm text-emerald-300">
                                        <Sparkles className="w-4 h-4 flex-shrink-0" />
                                        <span>{success}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="login-submit-btn w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#101e33] focus:ring-[#60a5fa] disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(96,165,250,0.3)]"
                                >
                                    <span className="login-btn-glow"></span>
                                    {isLoading ? <RefreshCw className="w-5 h-5 animate-spin" /> : 'Invia link di recupero'}
                                </button>

                                <button
                                    type="button"
                                    onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}
                                    className="w-full flex items-center justify-center gap-2 text-sm font-medium text-white/60 hover:text-white transition-colors"
                                >
                                    <ArrowLeft className="w-4 h-4" /> Torna al login
                                </button>
                            </form>

                        ) : (
                            /* MODALITÀ LOGIN STANDARD */
                            <form className="space-y-5" onSubmit={handleSubmit}>
                                <FloatingField
                                    id="email"
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    label="Indirizzo email"
                                    icon={<Mail className="h-5 w-5" />}
                                    autoComplete="email"
                                    required
                                />

                                <FloatingField
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    label={t('password_placeholder') || 'Password'}
                                    icon={<Lock className="h-5 w-5" />}
                                    autoComplete="current-password"
                                    required
                                    rightElement={
                                        <button type="button" className="login-toggle-password" onClick={() => setShowPassword(v => !v)} aria-label="Mostra/nascondi password">
                                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                        </button>
                                    }
                                />

                                <div className="flex items-center justify-end">
                                    <button
                                        type="button"
                                        onClick={() => { setShowForgot(true); setError(''); setSuccess(''); }}
                                        className="text-xs font-semibold text-[#9cc9ff] hover:text-white transition-colors"
                                    >
                                        Password dimenticata?
                                    </button>
                                </div>

                                {error && (
                                    <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-300">
                                        <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                        <span>{error}</span>
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="login-submit-btn w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-semibold text-white bg-gradient-to-r from-[#60a5fa] to-[#a78bfa] hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#101e33] focus:ring-[#60a5fa] disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(96,165,250,0.3)]"
                                >
                                    <span className="login-btn-glow"></span>
                                    {isLoading ? (
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                    ) : (
                                        t('login_button') || 'Accedi alla piattaforma'
                                    )}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            </main>

            <footer className="w-full text-center p-6 border-t border-white/10 bg-black/20 backdrop-blur-md z-10">
                <div className="text-xs text-white/40 flex flex-col sm:flex-row justify-center items-center gap-x-4 gap-y-1">
                    <a href="https://moise-web-srl.com/" target="_blank" rel="noopener noreferrer" className="hover:text-[#9cc9ff] transition-colors font-medium">
                        {t('footer_developed_by') || 'Sviluppato da Moise Web Srl'}
                    </a>
                    <span className="hidden sm:inline">|</span>
                    <span>{t('footer_hq') || 'HQ: Oradea, Romania'}</span>
                    <span className="hidden sm:inline">|</span>
                    <span>P.IVA: RO50469659</span>
                </div>
            </footer>
        </div>
    );
};

export default LoginPage;
