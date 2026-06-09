import { supabase } from '../lib/supabase';
import type { Notification } from '../types';

export async function getNotificationsForUser(userId: string, limit?: number): Promise<Notification[]> {
    let q = supabase.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false });
    if (limit) q = q.limit(limit);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return data as Notification[];
}

export async function markNotificationAsRead(notificationId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('id', notificationId);
    if (error) throw new Error(error.message);
}

export async function markAllNotificationsAsRead(userId: string): Promise<void> {
    const { error } = await supabase.from('notifications').update({ read: true }).eq('user_id', userId).eq('read', false);
    if (error) throw new Error(error.message);
}

export async function sendCustomNotification(userIds: string[], title: string, message: string): Promise<void> {
    if (!userIds.length || !message.trim() || !title.trim()) throw new Error('User IDs, title e message sono obbligatori.');
    const { error } = await supabase.from('notifications').insert(
        userIds.map(userId => ({ user_id: userId, title: title.trim(), message: message.trim(), read: false }))
    );
    if (error) throw new Error(error.message);
}

export async function getSentNotifications(): Promise<Notification[]> {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .is('lead_id', null)
        .not('title', 'is', null)
        .order('created_at', { ascending: false });

    if (error) throw new Error(error.message);

    const grouped = new Map<string, Notification>();
    for (const n of data || []) {
        const d = new Date(n.created_at);
        const key = `${n.title}|${n.message}|${d.getUTCFullYear()}-${d.getUTCMonth()}-${d.getUTCDate()}-${d.getUTCHours()}-${d.getUTCMinutes()}`;
        if (!grouped.has(key)) grouped.set(key, n);
    }
    return Array.from(grouped.values());
}

export async function updateSentNotification(original: Notification, newTitle: string, newMessage: string): Promise<void> {
    const { startTime, endTime } = _getMinuteWindow(original.created_at);
    const { data: batch, error: fetchErr } = await supabase
        .from('notifications')
        .select('user_id')
        .is('lead_id', null)
        .eq('title', original.title)
        .eq('message', original.message)
        .gte('created_at', startTime)
        .lte('created_at', endTime);

    if (fetchErr) throw new Error(fetchErr.message);
    if (!batch?.length) return;

    const userIds = [...new Set(batch.map(n => n.user_id))];

    await supabase.from('notifications').delete()
        .is('lead_id', null).eq('title', original.title).eq('message', original.message)
        .gte('created_at', startTime).lte('created_at', endTime);

    if (userIds.length) {
        const { error } = await supabase.from('notifications').insert(
            userIds.map(uid => ({ user_id: uid, title: newTitle.trim(), message: newMessage.trim(), read: false }))
        );
        if (error) throw new Error(error.message);
    }
}

export async function deleteSentNotification(n: Notification): Promise<void> {
    const { startTime, endTime } = _getMinuteWindow(n.created_at);
    const { error } = await supabase.from('notifications').delete()
        .is('lead_id', null).eq('title', n.title).eq('message', n.message)
        .gte('created_at', startTime).lte('created_at', endTime);
    if (error) throw new Error(error.message);
}

function _getMinuteWindow(created_at: string) {
    const d = new Date(created_at);
    const start = new Date(d); start.setUTCSeconds(0, 0);
    const end = new Date(d); end.setUTCSeconds(59, 999);
    return { startTime: start.toISOString(), endTime: end.toISOString() };
}
