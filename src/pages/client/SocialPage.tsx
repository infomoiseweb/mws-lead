import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import type { Client } from '../../types';
import { getClientByUserId } from '@api/clients';
import { Share2, Facebook, Instagram, Image, X, Send, AlertCircle, CheckCircle2, Clock, RefreshCw, Unlink } from 'lucide-react';

type Platform = 'facebook' | 'instagram' | 'both';
type PostStatus = 'idle' | 'loading' | 'success' | 'error';

interface PostResult {
    platform: string;
    success: boolean;
    post_id?: string;
    error?: string;
}

const IGIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/>
    </svg>
);

const FBIcon: React.FC<{ size?: number; className?: string }> = ({ size = 20, className }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" className={className}>
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
);

const SocialPage: React.FC = () => {
    const { user } = useAuth();
    const [client, setClient] = useState<Client | null>(null);
    const [loading, setLoading] = useState(true);

    // Composer state
    const [message, setMessage] = useState('');
    const [imageUrl, setImageUrl] = useState('');
    const [showImageInput, setShowImageInput] = useState(false);
    const [platform, setPlatform] = useState<Platform>('both');
    const [selectedPageId, setSelectedPageId] = useState<string>('');

    // Publish state
    const [status, setStatus] = useState<PostStatus>('idle');
    const [results, setResults] = useState<PostResult[]>([]);
    const [charCount, setCharCount] = useState(0);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (!user?.id) return;
        getClientByUserId(user.id).then(c => {
            setClient(c);
            if (c?.meta_pages && (c.meta_pages as any[]).length > 0) {
                setSelectedPageId((c.meta_pages as any[])[0].id);
            }
        }).finally(() => setLoading(false));
    }, [user?.id]);

    const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setMessage(e.target.value);
        setCharCount(e.target.value.length);
        // Auto-resize
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
        }
    };

    const handlePublish = async () => {
        if (!message.trim() && !imageUrl.trim()) return;
        if (!client) return;

        setStatus('loading');
        setResults([]);

        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        const newResults: PostResult[] = [];

        const pages = (client.meta_pages as any[]) || [];
        const page = pages.find(p => p.id === selectedPageId) || pages[0];
        const igActive = client.meta_instagram_active as any;

        try {
            if ((platform === 'facebook' || platform === 'both') && page) {
                const res = await fetch('/api/meta', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({
                        action: 'post_facebook',
                        client_id: client.id,
                        page_id: page.id,
                        message,
                        image_url: imageUrl || undefined,
                    }),
                });
                const data = await res.json();
                newResults.push({ platform: 'Facebook', success: data.success, post_id: data.post_id, error: data.error });
            }

            if ((platform === 'instagram' || platform === 'both') && igActive) {
                if (!imageUrl.trim()) {
                    newResults.push({ platform: 'Instagram', success: false, error: 'Instagram richiede un\'immagine' });
                } else {
                    const res = await fetch('/api/meta', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                            action: 'post_instagram',
                            client_id: client.id,
                            instagram_account_id: igActive.id,
                            message,
                            image_url: imageUrl,
                        }),
                    });
                    const data = await res.json();
                    newResults.push({ platform: 'Instagram', success: data.success, post_id: data.post_id, error: data.error });
                }
            }

            setResults(newResults);
            const allOk = newResults.every(r => r.success);
            setStatus(allOk ? 'success' : 'error');
            if (allOk) {
                setMessage('');
                setImageUrl('');
                setShowImageInput(false);
                setCharCount(0);
            }
        } catch (e: any) {
            setResults([{ platform: 'Errore', success: false, error: e.message }]);
            setStatus('error');
        }
    };

    const facebookConnected = !!client?.meta_access_token;
    const facebookPages = (client?.meta_pages as any[] || []);
    const instagramConnected = !!(client?.meta_instagram_active);
    const canPostFacebook = platform !== 'instagram' && facebookConnected && facebookPages.length > 0;
    const canPostInstagram = platform !== 'facebook' && instagramConnected;
    const hasAnythingToPost = (platform === 'facebook' && canPostFacebook) || (platform === 'instagram' && canPostInstagram) || (platform === 'both' && (canPostFacebook || canPostInstagram));
    const instagramNeedsImage = (platform === 'instagram' || platform === 'both') && instagramConnected && !imageUrl.trim();

    if (loading) return (
        <div className="flex items-center justify-center h-64">
            <RefreshCw className="w-6 h-6 animate-spin text-primary-500" />
        </div>
    );

    if (!client?.meta_enabled) return (
        <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <Share2 className="w-12 h-12 text-slate-300 dark:text-slate-600" />
            <p className="text-slate-500 dark:text-gray-400 font-medium">La sezione Social non è ancora attiva per il tuo account.</p>
            <p className="text-slate-400 dark:text-slate-500 text-sm">Contatta il tuo amministratore per abilitarla.</p>
        </div>
    );

    return (
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">

            {/* Header */}
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-pink-500 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-white" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-slate-800 dark:text-white">Pubblica sui Social</h1>
                    <p className="text-sm text-slate-500 dark:text-gray-400">Scrivi una volta, pubblica ovunque</p>
                </div>
            </div>

            {/* Status connessioni */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${facebookConnected ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <FBIcon size={20} className={facebookConnected ? 'text-[#1877F2]' : 'text-slate-400'} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Facebook</p>
                        {facebookConnected && facebookPages.length > 0 ? (
                            <p className="text-xs text-green-600 dark:text-green-400">✅ {facebookPages.length} pagina/e</p>
                        ) : facebookConnected ? (
                            <p className="text-xs text-amber-500">Collegato — nessuna pagina trovata</p>
                        ) : (
                            <p className="text-xs text-slate-400">Non collegato</p>
                        )}
                    </div>
                    {!facebookConnected && (
                        <a href={`/api/meta?client_id=${client.id}&redirect_to=client`} className="text-xs font-semibold text-[#1877F2] hover:underline">Collega</a>
                    )}
                </div>

                <div className={`flex items-center gap-3 p-3 rounded-xl border ${instagramConnected ? 'bg-pink-50 dark:bg-pink-900/20 border-pink-200 dark:border-pink-800' : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700'}`}>
                    <IGIcon size={20} className={instagramConnected ? 'text-pink-500' : 'text-slate-400'} />
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">Instagram</p>
                        {instagramConnected ? (
                            <p className="text-xs text-green-600 dark:text-green-400">✅ {(client.meta_instagram_active as any).page_name}</p>
                        ) : facebookConnected ? (
                            <p className="text-xs text-amber-500">Seleziona account in Integrazioni</p>
                        ) : (
                            <p className="text-xs text-slate-400">Prima collega Facebook</p>
                        )}
                    </div>
                </div>
            </div>

            {/* Composer */}
            {(facebookConnected || instagramConnected) && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">

                    {/* Selettore piattaforma */}
                    <div className="flex border-b border-slate-100 dark:border-slate-700">
                        {[
                            { value: 'both', label: 'Entrambi', disabled: !facebookConnected || !instagramConnected },
                            { value: 'facebook', label: 'Solo Facebook', disabled: !facebookConnected },
                            { value: 'instagram', label: 'Solo Instagram', disabled: !instagramConnected },
                        ].map(opt => (
                            <button
                                key={opt.value}
                                onClick={() => !opt.disabled && setPlatform(opt.value as Platform)}
                                disabled={opt.disabled}
                                className={`flex-1 py-3 text-xs font-semibold transition-all border-b-2 ${
                                    platform === opt.value
                                        ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                                        : opt.disabled
                                            ? 'border-transparent text-slate-300 dark:text-slate-600 cursor-not-allowed'
                                            : 'border-transparent text-slate-500 dark:text-gray-400 hover:text-slate-700 dark:hover:text-gray-200'
                                }`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    {/* Textarea */}
                    <div className="p-4">
                        <textarea
                            ref={textareaRef}
                            value={message}
                            onChange={handleMessageChange}
                            placeholder="Scrivi il tuo post..."
                            rows={4}
                            className="w-full resize-none bg-transparent text-slate-800 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 text-sm leading-relaxed focus:outline-none"
                            style={{ minHeight: '100px' }}
                        />

                        {/* Immagine URL */}
                        {showImageInput && (
                            <div className="mt-3 flex items-center gap-2">
                                <input
                                    type="url"
                                    value={imageUrl}
                                    onChange={e => setImageUrl(e.target.value)}
                                    placeholder="URL immagine (https://...)"
                                    className="flex-1 text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-gray-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-400"
                                />
                                <button onClick={() => { setShowImageInput(false); setImageUrl(''); }} className="p-2 text-slate-400 hover:text-red-500 transition">
                                    <X size={16} />
                                </button>
                            </div>
                        )}

                        {imageUrl && (
                            <div className="mt-3 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 max-h-48">
                                <img src={imageUrl} alt="Anteprima" className="w-full object-cover max-h-48" onError={e => (e.currentTarget.style.display = 'none')} />
                            </div>
                        )}
                    </div>

                    {/* Avviso Instagram senza immagine */}
                    {instagramNeedsImage && (
                        <div className="mx-4 mb-3 flex items-center gap-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                            <AlertCircle size={14} className="text-amber-500 flex-shrink-0" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">Instagram richiede un'immagine per pubblicare</p>
                        </div>
                    )}

                    {/* Selettore pagina Facebook (se più di una) */}
                    {platform !== 'instagram' && facebookConnected && (client.meta_pages as any[]).length > 1 && (
                        <div className="px-4 pb-3">
                            <label className="text-xs font-semibold text-slate-500 dark:text-gray-400 uppercase tracking-wide block mb-1.5">Pagina Facebook</label>
                            <select
                                value={selectedPageId}
                                onChange={e => setSelectedPageId(e.target.value)}
                                className="w-full text-sm px-3 py-2 rounded-lg bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-400"
                            >
                                {(client.meta_pages as any[]).map((p: any) => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Footer composer */}
                    <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setShowImageInput(v => !v)}
                                className={`p-2 rounded-lg transition-colors ${showImageInput ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-gray-200 hover:bg-slate-100 dark:hover:bg-slate-700'}`}
                                title="Aggiungi immagine"
                            >
                                <Image size={18} />
                            </button>
                            <span className={`text-xs ${charCount > 2000 ? 'text-red-500' : 'text-slate-400'}`}>{charCount}/2000</span>
                        </div>
                        <button
                            onClick={handlePublish}
                            disabled={status === 'loading' || (!message.trim() && !imageUrl.trim()) || !hasAnythingToPost || charCount > 2000}
                            className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-blue-500 to-pink-500 hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
                        >
                            {status === 'loading' ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                            {status === 'loading' ? 'Pubblicando...' : 'Pubblica'}
                        </button>
                    </div>
                </div>
            )}

            {/* Risultati pubblicazione */}
            {results.length > 0 && (
                <div className="space-y-2">
                    {results.map((r, i) => (
                        <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${r.success ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`}>
                            {r.success
                                ? <CheckCircle2 size={18} className="text-green-500 flex-shrink-0 mt-0.5" />
                                : <AlertCircle size={18} className="text-red-500 flex-shrink-0 mt-0.5" />
                            }
                            <div>
                                <p className="text-sm font-semibold text-slate-700 dark:text-gray-200">
                                    {r.success ? `✅ Pubblicato su ${r.platform}` : `❌ Errore su ${r.platform}`}
                                </p>
                                {r.success && r.post_id && <p className="text-xs text-slate-500 dark:text-gray-400 mt-0.5">ID post: {r.post_id}</p>}
                                {!r.success && r.error && <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">{r.error}</p>}
                            </div>
                        </div>
                    ))}
                    {status === 'success' && (
                        <button onClick={() => { setResults([]); setStatus('idle'); }} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-gray-300 transition">
                            Chiudi
                        </button>
                    )}
                </div>
            )}

            {/* Placeholder se niente collegato */}
            {!facebookConnected && !instagramConnected && (
                <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-100 to-pink-100 dark:from-blue-900/30 dark:to-pink-900/30 flex items-center justify-center">
                        <Share2 className="w-8 h-8 text-slate-400" />
                    </div>
                    <div>
                        <p className="font-semibold text-slate-600 dark:text-gray-300">Nessun social collegato</p>
                        <p className="text-sm text-slate-400 dark:text-slate-500 mt-1">Vai alla sezione <strong>Integrazioni</strong> per collegare Facebook e Instagram</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SocialPage;
