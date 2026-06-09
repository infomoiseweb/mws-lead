import React, { createContext, useState, useContext, useEffect, ReactNode } from 'react';
import type { User } from '../types';
import { supabase } from '../lib/supabase';

interface AuthContextType {
    user: User | null;
    login: (email: string, password: string) => Promise<User | null>;
    logout: () => Promise<void>;
    isLoading: boolean;
    updateUserContext: (updates: Partial<User>) => void;
    forgotPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

async function fetchUserProfile(userId: string): Promise<User | null> {
    const { data: profile, error } = await supabase
        .from('users')
        .select('id, username, role, email, phone, status, created_at')
        .eq('id', userId)
        .single();

    if (error || !profile) return null;
    return profile as User;
}

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        // Carica la sessione esistente all'avvio
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (session?.user) {
                const profile = await fetchUserProfile(session.user.id);
                if (profile) setUser(profile);
            }
            setIsLoading(false);
        });

        // Aggiorna lo stato in risposta ai cambiamenti di sessione Supabase
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (event === 'SIGNED_IN' && session?.user) {
                const profile = await fetchUserProfile(session.user.id);
                if (profile) setUser(profile);
            } else if (event === 'SIGNED_OUT') {
                setUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const login = async (email: string, password: string): Promise<User | null> => {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) throw new Error(error.message);
        if (!data.user) return null;

        const profile = await fetchUserProfile(data.user.id);
        if (!profile) throw new Error('Profilo utente non trovato.');
        if (profile.status === 'suspended') {
            await supabase.auth.signOut();
            throw new Error('Questo account è stato sospeso.');
        }

        setUser(profile);
        return profile;
    };

    const logout = async () => {
        await supabase.auth.signOut();
        setUser(null);
    };

    const updateUserContext = (updates: Partial<User>) => {
        if (user) setUser({ ...user, ...updates });
    };

    const forgotPassword = async (email: string) => {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/#/login?reset=true`,
        });
        if (error) throw new Error(error.message);
    };

    return (
        <AuthContext.Provider value={{ user, login, logout, isLoading, updateUserContext, forgotPassword }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) throw new Error('useAuth must be used within an AuthProvider');
    return context;
};
