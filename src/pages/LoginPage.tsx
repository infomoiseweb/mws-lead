import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@contexts/AuthContext';
import { Lock, User, Mail, Sparkles, KeyRound, ArrowLeft, RefreshCw, AlertCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';

const LoginPage: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { login, forgotPassword } = useAuth();

    // Form states
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Forgot password states
    const [showForgot, setShowForgot] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');

    // Reset password states (if routed from email link)
    const [isResetMode, setIsResetMode] = useState(false);
    const [newPassword, setNewPassword] = useState('');

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
                    navigate('/admin/dashboard');
                } else {
                    navigate(`/client/${user.id}/dashboard`);
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
        if (!newPassword || newPassword.length < 6) {
            setError('La password deve contenere almeno 6 caratteri.');
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
        <div className="min-h-screen flex flex-col bg-slate-900 text-slate-150 relative overflow-hidden font-sans">
            {/* Sfondo Astratto 3D di profondità */}
            <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary-900/20 blur-[130px] pointer-events-none"></div>
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-purple-950/20 blur-[120px] pointer-events-none"></div>

            <main className="flex-grow flex items-center justify-center p-4 z-10">
                <div className="w-full max-w-md p-8 bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)] rounded-2xl relative transition-all duration-300">
                    
                    {/* Elemento decorativo 3D Glow Line in alto */}
                    <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-primary-500 via-primary-400 to-purple-600 rounded-t-2xl"></div>

                    <div className="text-center">
                        <div className="relative inline-block">
                            <img 
                                src="https://moise-web-srl.com/wp-content/uploads/2025/07/web-app-manifest-512x512-2.png" 
                                alt="MWS Lead Hub Logo" 
                                className="mx-auto h-24 w-24 object-contain filter drop-shadow-[0_10px_15px_rgba(59,130,246,0.3)] transition-transform duration-500 hover:scale-105" 
                            />
                            <div className="absolute bottom-1 right-1 bg-primary-500 text-[10px] uppercase font-bold text-slate-900 px-1 py-0.5 rounded shadow-lg flex items-center gap-1">
                                <Sparkles className="w-2.5 h-2.5" /> Beta
                            </div>
                        </div>
                        
                        <h2 className="mt-4 text-center text-3xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-white via-slate-100 to-slate-300">
                            {isResetMode ? 'Nuova Password' : showForgot ? 'Recupero Password' : 'MWS Lead Hub'}
                        </h2>
                        
                        <p className="mt-2 text-center text-sm text-slate-400">
                            {isResetMode 
                                ? 'Imposta la tua nuova credenziale di accesso.' 
                                : showForgot 
                                    ? 'Inserisci la tua email per ricevere il link di ripristino.' 
                                    : t('login_subtitle') || 'Accedi alla console di gestione lead multi-tenant.'}
                        </p>
                    </div>

                    {isResetMode ? (
                        /* MODALITÀ RESET PASSWORD */
                        <form className="mt-8 space-y-6" onSubmit={handleResetPassword}>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <KeyRound className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="password"
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="appearance-none relative block w-full px-3 py-3 pl-10 bg-slate-900/60 border border-slate-700/80 placeholder-slate-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm"
                                    placeholder="Nuova password (min. 6 caratteri)"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-sm text-emerald-400">
                                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                                    <span>{success}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-slate-950 bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-400 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)]"
                            >
                                {isLoading ? 'Aggiornamento...' : 'Ripristina Password'}
                            </button>

                            <button
                                type="button"
                                onClick={() => setIsResetMode(false)}
                                className="w-full text-center text-sm font-medium text-primary-400 hover:text-primary-300 transition-colors"
                            >
                                Torna al Login
                            </button>
                        </form>

                    ) : showForgot ? (
                        /* MODALITÀ FORGOT PASSWORD */
                        <form className="mt-8 space-y-6" onSubmit={handleForgotPassword}>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-slate-400" />
                                </div>
                                <input
                                    type="email"
                                    required
                                    value={forgotEmail}
                                    onChange={(e) => setForgotEmail(e.target.value)}
                                    className="appearance-none relative block w-full px-3 py-3 pl-10 bg-slate-900/60 border border-slate-700/80 placeholder-slate-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm"
                                    placeholder="Indirizzo Email"
                                />
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            {success && (
                                <div className="flex items-center gap-2 p-3 bg-emerald-950/40 border border-emerald-500/30 rounded-lg text-sm text-emerald-400">
                                    <Sparkles className="w-4 h-4 flex-shrink-0" />
                                    <span>{success}</span>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-slate-950 bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-400 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)]"
                            >
                                {isLoading ? 'Invio in corso...' : 'Invia Link di Recupero'}
                            </button>

                            <button
                                type="button"
                                onClick={() => { setShowForgot(false); setError(''); setSuccess(''); }}
                                className="w-full flex items-center justify-center gap-2 text-sm font-medium text-slate-400 hover:text-white transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Torna al Login
                            </button>
                        </form>

                    ) : (
                        /* MODALITÀ LOGIN STANDARD */
                        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                            <div className="space-y-4">
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <User className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="email"
                                        name="email"
                                        type="email"
                                        autoComplete="email"
                                        required
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="appearance-none relative block w-full px-3 py-3 pl-10 bg-slate-900/60 border border-slate-700/80 placeholder-slate-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm"
                                        placeholder="Indirizzo Email"
                                    />
                                </div>
                                <div className="relative">
                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                        <Lock className="h-5 w-5 text-slate-400" />
                                    </div>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        autoComplete="current-password"
                                        required
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="appearance-none relative block w-full px-3 py-3 pl-10 bg-slate-900/60 border border-slate-700/80 placeholder-slate-500 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent sm:text-sm"
                                        placeholder={t('password_placeholder') || 'Password'}
                                    />
                                </div>
                            </div>

                            <div className="flex items-center justify-end">
                                <button
                                    type="button"
                                    onClick={() => { setShowForgot(true); setError(''); setSuccess(''); }}
                                    className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition-colors"
                                >
                                    Password dimenticata?
                                </button>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-red-950/40 border border-red-500/30 rounded-lg text-sm text-red-400">
                                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                    <span>{error}</span>
                                </div>
                            )}

                            <div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full flex justify-center py-3 px-4 border border-transparent text-sm font-semibold rounded-lg text-slate-950 bg-gradient-to-r from-primary-400 to-primary-500 hover:from-primary-500 hover:to-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900 focus:ring-primary-400 disabled:opacity-50 transition-all shadow-[0_4px_20px_rgba(59,130,246,0.3)]"
                                >
                                    {isLoading ? (
                                        <RefreshCw className="w-5 h-5 animate-spin text-slate-950" />
                                    ) : (
                                        t('login_button') || 'Accedi alla Piattaforma'
                                    )}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </main>

            <footer className="w-full text-center p-6 border-t border-slate-800 bg-slate-950/60 backdrop-blur-md">
                <div className="text-xs text-slate-500 flex flex-col sm:flex-row justify-center items-center gap-x-4 gap-y-1">
                    <a href="https://moise-web-srl.com/" target="_blank" rel="noopener noreferrer" className="hover:text-primary-400 transition-colors font-medium">
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
