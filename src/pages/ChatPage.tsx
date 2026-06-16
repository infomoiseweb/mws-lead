import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, RotateCcw } from 'lucide-react';
import { useAuth } from '@contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import { supabase } from '@lib/supabase';

interface ChatMessage {
    role: 'user' | 'model';
    text: string;
}

const ChatPage: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { user } = useAuth();
    const chatSessionKey = user ? `mws-chat-session-${user.id}` : null;

    const [messages, setMessages] = useState<ChatMessage[]>(() => {
        if (!chatSessionKey) return [];
        try {
            const savedMessages = sessionStorage.getItem(chatSessionKey);
            return savedMessages ? JSON.parse(savedMessages) : [];
        } catch (e) {
            console.error("Could not load chat from session storage:", e);
            return [];
        }
    });

    // history usata per passare il contesto al proxy server-side
    const historyRef = useRef<{ role: string; parts: { text: string }[] }[]>([]);

    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const messagesEndRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (messages.length === 0 && user?.username) {
            const greeting = { role: 'model' as const, text: t('page_chat.initial_greeting', { username: user.username }) };
            setMessages([greeting]);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [user?.id, i18n.language]);

    // Sincronizza historyRef con messages (esclude il saluto iniziale dall'history AI)
    useEffect(() => {
        historyRef.current = messages
            .filter(m => m.text.trim() !== '')
            .map(m => ({ role: m.role, parts: [{ text: m.text }] }));
    }, [messages]);

    useEffect(() => {
        if (chatSessionKey) {
            try {
                sessionStorage.setItem(chatSessionKey, JSON.stringify(messages));
            } catch (e) {
                console.error("Could not save chat to session storage:", e);
            }
        }
    }, [messages, chatSessionKey]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(scrollToBottom, [messages, isLoading]);

    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userInput.trim() || isLoading) return;

        const userMessage: ChatMessage = { role: 'user', text: userInput };
        const currentInput = userInput;
        setMessages(prev => [...prev, userMessage]);
        setUserInput('');
        setIsLoading(true);
        setError('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) throw new Error('Sessione scaduta, effettua di nuovo il login.');

            // History esclude l'ultimo messaggio utente appena aggiunto (non ancora inviato)
            const history = historyRef.current.slice(0, -1);

            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({
                    message: currentInput,
                    history,
                    systemInstruction: t('page_chat.system_instruction', { username: user?.username || 'user', lng: i18n.language }),
                }),
            });

            if (!res.ok) {
                const body = await res.json().catch(() => ({}));
                throw new Error(body.error || `Errore ${res.status}`);
            }

            const { text } = await res.json();
            setMessages(prev => [...prev, { role: 'model', text: text || '' }]);
        } catch (e: any) {
            console.error("Error sending message:", e);
            setError(e.message || t('page_chat.send_error'));
            setMessages(prev => prev.slice(0, -1));
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetChat = () => {
        if (window.confirm(t('page_chat.confirm_reset'))) {
            setIsLoading(false);
            if (chatSessionKey) sessionStorage.removeItem(chatSessionKey);
            const initialMessages = [{
                role: 'model' as const,
                text: t('page_chat.initial_greeting', { username: user?.username || '' })
            }];
            setMessages(initialMessages);
        }
    };

    const MessageBubble: React.FC<{ message: ChatMessage }> = ({ message }) => {
        const isUser = message.role === 'user';
        return (
            <div className={`flex items-start gap-3 ${isUser ? 'justify-end' : ''}`}>
                {!isUser && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white">
                        <Bot size={20} />
                    </div>
                )}
                <div
                    className={`max-w-xs md:max-w-md lg:max-w-lg px-4 py-3 rounded-2xl ${
                        isUser
                            ? 'bg-primary-600 text-white rounded-br-lg'
                            : 'bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-gray-200 rounded-bl-lg'
                    }`}
                >
                    <p className="text-sm whitespace-pre-wrap">{message.text}</p>
                </div>
                {isUser && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white">
                        <User size={20} />
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 max-w-4xl mx-auto flex flex-col h-[calc(100vh-10rem)]">
            <div className="flex items-center space-x-3 p-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <Bot className="w-8 h-8 text-primary-500 dark:text-primary-400" />
                <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">{t('page_chat.title')}</h2>
                    <p className="text-xs text-green-500 font-semibold flex items-center">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></span>
                        {t('page_chat.online')}
                    </p>
                </div>
                <button
                    onClick={handleResetChat}
                    className="ml-auto p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title={t('page_chat.reset_tooltip')}
                    aria-label={t('page_chat.reset_tooltip')}
                >
                    <RotateCcw className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                </button>
            </div>

            <div className="flex-1 p-4 sm:p-6 overflow-y-auto space-y-6">
                {messages.map((msg, index) => (
                    <MessageBubble key={index} message={msg} />
                ))}
                {isLoading && (
                    <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary-500 flex items-center justify-center text-white">
                            <Bot size={20} />
                        </div>
                        <div className="max-w-xs px-4 py-3 rounded-2xl rounded-bl-lg bg-slate-200 dark:bg-slate-700 text-slate-800 dark:text-gray-200">
                            <Loader2 className="w-5 h-5 animate-spin text-slate-500" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {error && (
                <div className="px-4 py-2 text-sm text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 border-t border-slate-200 dark:border-slate-700">
                    {error}
                </div>
            )}

            <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
                <form onSubmit={handleSendMessage} className="flex items-center space-x-3">
                    <input
                        type="text"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        placeholder={t('page_chat.placeholder')}
                        className="flex-1 w-full p-3 bg-slate-100 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !userInput.trim()}
                        className="w-12 h-12 flex items-center justify-center bg-primary-600 text-white rounded-full shadow hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                        aria-label={t('page_chat.send_aria_label')}
                    >
                        <Send size={20} />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default ChatPage;
