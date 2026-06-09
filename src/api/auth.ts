import { supabase } from '../lib/supabase';
import type { User } from '../types';

export async function getUserById(userId: string): Promise<User | null> {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, role, email, phone, status, created_at')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data as User;
}

export async function getUsers(): Promise<User[]> {
    const { data, error } = await supabase
        .from('users')
        .select('id, username, role, email, phone, status, created_at');
    if (error) throw new Error(error.message);
    return data as User[];
}

export async function updateUser(
    userId: string,
    updates: Partial<Pick<User, 'username' | 'email' | 'phone'>>
): Promise<User> {
    if (updates.username) {
        const { data: existing } = await supabase
            .from('users')
            .select('id')
            .eq('username', updates.username)
            .not('id', 'eq', userId)
            .single();
        if (existing) throw new Error('Username already exists.');
    }

    const { data, error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select('id, username, role, email, phone, status, created_at')
        .single();

    if (error) throw new Error(error.message);
    return data as User;
}

export async function updateUserStatus(userId: string, status: User['status']): Promise<User> {
    const { data, error } = await supabase
        .from('users')
        .update({ status })
        .eq('id', userId)
        .select('id, username, role, email, phone, status, created_at')
        .single();
    if (error) throw new Error(error.message);
    return data as User;
}

export async function broadcastForceLogout(userId: string): Promise<void> {
    const channel = supabase.channel('force-logout');
    await channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
            await channel.send({ type: 'broadcast', event: 'logout', payload: { userId } });
            supabase.removeChannel(channel);
        }
    });
}
