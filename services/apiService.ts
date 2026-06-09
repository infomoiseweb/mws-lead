
import { supabase } from '../supabaseClient';
// FIX: Imported SavedForm type to be used in new API methods.
import type { User, Client, Lead, Note, AdSpend, Service, SavedForm, Notification, MwsMonthlyRevenue, Quote, QuoteItem, Appointment, CalendarAppointment, QuoteWithDetails } from '../types';

interface AddLeadOptions {
    clientId: string;
    leadData: Record<string, string>;
    service?: string;
    status?: Lead['status'];
    value?: number;
    createdAt?: string;
}

export class ApiService {
    
    private static unpackMwsSettings<T extends { services?: any, mws_fixed_fee?: number, mws_profit_percentage?: number }>(clientData: T): T {
        if (!clientData) {
            return clientData;
        }

        const clientWithSettings = { ...clientData };
        let rawServices = clientWithSettings.services;

        if (typeof rawServices === 'string') {
            try {
                rawServices = JSON.parse(rawServices);
            } catch (e) {
                console.error("Failed to parse services JSON for client:", (clientData as any).id);
                rawServices = [];
            }
        }
        
        const servicesArray = Array.isArray(rawServices) ? rawServices : [];

        const mwsSettings = servicesArray.find((s: any) => s && s.id === 'mws_settings');
        if (mwsSettings) {
            clientWithSettings.mws_fixed_fee = mwsSettings.mws_fixed_fee;
            clientWithSettings.mws_profit_percentage = mwsSettings.mws_profit_percentage;
        }

        clientWithSettings.services = servicesArray.filter((s: any) => s && s.id !== 'mws_settings');
        
        return clientWithSettings;
    }


    static async getClients(startDate?: Date | null, endDate?: Date | null): Promise<Client[]> {
        const { data: clientsData, error: clientsError } = await supabase
            .from('clients')
            .select('*');

        if (clientsError) throw new Error(clientsError.message);

        const clientsWithData = await Promise.all(clientsData.map(async (client) => {
            let query = supabase.from('leads').select('*, notes(*), appointments(*)').eq('client_id', client.id).order('created_at', { ascending: false });
            
            if (startDate) {
                query = query.gte('created_at', startDate.toISOString());
            }
            if (endDate) {
                query = query.lte('created_at', endDate.toISOString());
            }
            
            // Usiamo sempre un limite alto per evitare troncamenti silenziosi
            query = query.limit(10000);

            const { data: leads } = await query;
            const { data: adSpends } = await supabase.from('ad_spends').select('*').eq('client_id', client.id);
            
            const unpackedClient = ApiService.unpackMwsSettings(client);

            return {
                ...unpackedClient,
                leads: (leads || []) as Lead[],
                adSpends: (adSpends || []) as AdSpend[],
            };
        }));

        return clientsWithData as Client[];
    }

    static async getUsers(): Promise<User[]> {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, role, email, phone, status, created_at');
        if (error) throw new Error(error.message);
        return data as User[];
    }

    static async getClientByUserId(userId: string, startDate?: Date | null, endDate?: Date | null): Promise<Client | null> {
        const { data: client, error } = await supabase
            .from('clients')
            .select('*')
            .eq('user_id', userId)
            .single();
            
        if (error || !client) {
             console.error("Error fetching client by user ID", error?.message);
             return null;
        }

        let leadsQuery = supabase.from('leads').select('*, notes(*), appointments(*)').eq('client_id', client.id).order('created_at', { ascending: false });
        
        if (startDate) {
            leadsQuery = leadsQuery.gte('created_at', startDate.toISOString());
        }
        if (endDate) {
            leadsQuery = leadsQuery.lte('created_at', endDate.toISOString());
        }
        
        // Usiamo sempre un limite alto per evitare troncamenti silenziosi
        leadsQuery = leadsQuery.limit(10000);

        const [{data: leads}, {data: spends}] = await Promise.all([
             leadsQuery,
             supabase.from('ad_spends').select('*').eq('client_id', client.id)
        ]);
        
        const unpackedClient = ApiService.unpackMwsSettings(client);

        return {
            ...unpackedClient,
            leads: (leads || []) as Lead[],
            adSpends: (spends || []) as AdSpend[],
        } as Client;
    }
    
    // L'email è usata come login tramite Supabase Auth. La password viene gestita da Supabase Auth,
    // non salvata nel nostro DB. Il trigger handle_new_user() crea il profilo in public.users automaticamente.
    static async addClient(name: string, username: string, email: string, password: string, services: Omit<Service, 'id'>[], quote_webhook_url?: string): Promise<Client> {
        if (!email || !password || password.trim().length === 0) {
            throw new Error('Email e password sono obbligatorie.');
        }

        // 1. Crea utente in Supabase Auth (la password viene hashata da Supabase)
        const { data: authData, error: authError } = await supabase.auth.admin
            ? await (supabase.auth as any).admin.createUser({ email, password, user_metadata: { username, role: 'client' } })
            : { data: null, error: new Error('admin API non disponibile dal client') };

        // Fallback: usa signUp (richiede conferma email, ma è sicuro)
        if (authError || !authData?.user) {
            throw new Error(`Impossibile creare utente Auth: usa il pannello Supabase per creare l'utente con email ${email}, poi usa addClientForExistingUser().`);
        }

        const newUserId = authData.user.id;

        // 2. Il trigger handle_new_user() crea la riga in public.users automaticamente.
        // Aggiorniamo il username che potrebbe essere diverso dall'email.
        await supabase.from('users').update({ username }).eq('id', newUserId);

        // 3. Crea il client
        const servicesWithIds = services.map(s => ({
            ...s,
            id: `service_${Date.now()}_${Math.random()}`,
            fields: s.fields.map(f => ({ ...f, id: `field_${Date.now()}_${Math.random()}` }))
        }));

        const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({ name, user_id: newUserId, services: servicesWithIds, quote_webhook_url })
            .select()
            .single();

        if (clientError) throw new Error(clientError.message);

        return { ...newClient, leads: [], adSpends: [], services: newClient.services || [] } as Client;
    }

    // Versione semplificata: crea il client per un utente Auth già esistente (creato dal pannello Supabase)
    static async addClientForExistingUser(userId: string, name: string, username: string, services: Omit<Service, 'id'>[], quote_webhook_url?: string): Promise<Client> {
        await supabase.from('users').update({ username, role: 'client', status: 'active' }).eq('id', userId);

        const servicesWithIds = services.map(s => ({
            ...s,
            id: `service_${Date.now()}_${Math.random()}`,
            fields: s.fields.map(f => ({ ...f, id: `field_${Date.now()}_${Math.random()}` }))
        }));

        const { data: newClient, error: clientError } = await supabase
            .from('clients')
            .insert({ name, user_id: userId, services: servicesWithIds, quote_webhook_url })
            .select()
            .single();

        if (clientError) throw new Error(clientError.message);
        return { ...newClient, leads: [], adSpends: [], services: newClient.services || [] } as Client;
    }

    static async updateClient(clientId: string, updates: Partial<Pick<Client, 'name' | 'services' | 'mws_fixed_fee' | 'mws_profit_percentage' | 'quote_webhook_url'>>): Promise<Client> {
        const { mws_fixed_fee, mws_profit_percentage, ...otherUpdates } = updates;
        const updatesForSupabase: Partial<Pick<Client, 'name' | 'services' | 'quote_webhook_url'>> = { ...otherUpdates };

        const mwsSettingsProvided = mws_fixed_fee !== undefined || mws_profit_percentage !== undefined;

        if (mwsSettingsProvided || updates.services) {
            const { data: currentClientData, error: fetchError } = await supabase
                .from('clients')
                .select('services')
                .eq('id', clientId)
                .single();

            if (fetchError) throw new Error(fetchError.message);

            let currentServices = currentClientData.services || [];
            if (typeof currentServices === 'string') {
                try {
                    currentServices = JSON.parse(currentServices);
                } catch (e) {
                    currentServices = [];
                }
            }

            let userServices = Array.isArray(currentServices) ? currentServices.filter((s: any) => s && s.id !== 'mws_settings') : [];
            let mwsSettings = Array.isArray(currentServices) ? currentServices.find((s: any) => s && s.id === 'mws_settings') : undefined;
            if (!mwsSettings) {
                mwsSettings = { id: 'mws_settings', name: '_mws_settings' };
            }

            if (updates.services) {
                userServices = updates.services;
            }

            if (mwsSettingsProvided) {
                if (mws_fixed_fee !== undefined) (mwsSettings as any).mws_fixed_fee = mws_fixed_fee;
                if (mws_profit_percentage !== undefined) (mwsSettings as any).mws_profit_percentage = mws_profit_percentage;
            }
            
            updatesForSupabase.services = [...userServices, mwsSettings];
        }

        if (updatesForSupabase.services) {
            const updatedServicesWithIds = updatesForSupabase.services.map(s => ({
                ...s,
                id: (s.id && !s.id.startsWith('new_')) ? s.id : (s.id === 'mws_settings' ? 'mws_settings' : `service_${Date.now()}_${Math.random()}`),
                fields: s.fields ? s.fields.map(f => ({
                    ...f,
                    id: (f.id && !f.id.startsWith('new_')) ? f.id : `field_${Date.now()}_${Math.random()}`
                })) : undefined
            }));
            updatesForSupabase.services = updatedServicesWithIds;
        }
        
        const { data, error } = await supabase
            .from('clients')
            .update(updatesForSupabase)
            .eq('id', clientId)
            .select()
            .single();

        if (error) throw new Error(error.message);
        
        const unpackedClient = ApiService.unpackMwsSettings(data);
        return { ...unpackedClient, leads: [], adSpends: [] } as Client;
    }
    
    static async deleteClient(clientId: string): Promise<void> {
        // Find user_id first to delete the user
        const { data: client, error: findError } = await supabase.from('clients').select('user_id').eq('id', clientId).single();
        if(findError) throw new Error(findError.message);
        if(!client) throw new Error("Client not found.");

        // ON DELETE CASCADE will handle deleting the client, leads, etc.
        const { error } = await supabase.from('users').delete().eq('id', client.user_id);
        if (error) throw new Error(error.message);
    }
    
    static async deleteClientByUserId(userId: string): Promise<void> {
        const { error } = await supabase.from('users').delete().eq('id', userId);
        if (error) throw new Error(error.message);
    }

    static async addLead({ clientId, leadData, service, status, value, createdAt }: AddLeadOptions): Promise<Lead> {
        const leadToInsert: { [key: string]: any } = {
            client_id: clientId,
            data: leadData,
            service,
            status: status || 'Nuovo',
            value
        };

        if (createdAt) {
            leadToInsert.created_at = new Date(createdAt).toISOString();
        }

        const { data, error } = await supabase.from('leads').insert(leadToInsert).select().single();
        if (error) throw new Error(error.message);
        const newLead = data as Lead;
        
        // --- Create Notifications ---
        try {
            const { data: clientData } = await supabase.from('clients').select('user_id, name').eq('id', clientId).single();
            const { data: adminUser } = await supabase.from('users').select('id').eq('role', 'admin').single();

            if (clientData && adminUser) {
                const notificationsToInsert = [
                    // Notification for the client
                    {
                        user_id: clientData.user_id,
                        title: `Nuovo Lead Ricevuto!`,
                        message: `Hai ricevuto un nuovo lead: '${leadData.nome || 'N/D'}'. Clicca per vedere i dettagli.`,
                        lead_id: newLead.id,
                        client_id: clientId
                    },
                    // Notification for the admin
                    {
                        user_id: adminUser.id,
                        title: `Nuovo Lead per ${clientData.name}`,
                        message: `È stato registrato un nuovo lead '${leadData.nome || 'N/D'}' per il cliente '${clientData.name}'.`,
                        lead_id: newLead.id,
                        client_id: clientId
                    }
                ];
                
                await supabase.from('notifications').insert(notificationsToInsert);
            }
        } catch(notificationError) {
            console.error("Failed to create notifications:", notificationError);
            // Non-blocking error, so we just log it.
        }

        return newLead;
    }

    static async addHistoricalLead(
        options: {
            clientId: string;
            originalLeadData: Record<string, string>;
            service: string;
            value: number;
            date: string; // YYYY-MM-DD
            notes?: string;
        }
    ): Promise<Lead> {
        const { clientId, originalLeadData, service, value, date, notes } = options;
    
        const leadToInsert = {
            client_id: clientId,
            data: { ...originalLeadData, _is_historical: 'true' },
            service,
            status: 'Vinto' as const,
            value,
            created_at: new Date(date).toISOString(),
        };
    
        const { data: newLead, error: leadError } = await supabase
            .from('leads')
            .insert(leadToInsert)
            .select()
            .single();
        
        if (leadError) throw new Error(leadError.message);
    
        if (notes && notes.trim() !== '') {
            const { error: noteError } = await supabase
                .from('notes')
                .insert({ lead_id: newLead.id, content: notes });
    
            if (noteError) {
                console.error("Could not add note to historical lead:", noteError.message);
            }
        }
    
        const { data: finalLead, error: fetchError } = await supabase
            .from('leads')
            .select('*, notes(*), appointments(*)')
            .eq('id', newLead.id)
            .single();
    
        if (fetchError) throw new Error(fetchError.message);
    
        return finalLead as Lead;
    }

    static async updateHistoricalLead(
        leadId: string,
        updates: {
            service: string;
            value: number;
            date: string; // YYYY-MM-DD
            notes?: string;
        },
        existingNoteId?: string
    ): Promise<Lead> {
        const { service, value, date, notes } = updates;
    
        const leadUpdates = {
            service,
            value,
            created_at: new Date(date).toISOString(),
        };
    
        const { data: updatedLead, error: leadError } = await supabase
            .from('leads')
            .update(leadUpdates)
            .eq('id', leadId)
            .select()
            .single();
        
        if (leadError) throw new Error(leadError.message);
    
        // Handle notes. Check for undefined to distinguish from empty string.
        if (notes !== undefined) {
            if (notes.trim() !== '') { // If notes has content
                if (existingNoteId) {
                    // Update existing note
                    const { error: noteError } = await supabase
                        .from('notes')
                        .update({ content: notes })
                        .eq('id', existingNoteId);
                    if (noteError) console.warn("Could not update note:", noteError.message);
                } else {
                    // Add new note
                    const { error: noteError } = await supabase
                        .from('notes')
                        .insert({ lead_id: leadId, content: notes });
                    if (noteError) console.warn("Could not add note:", noteError.message);
                }
            } else if (existingNoteId) { // If notes is empty string and there was a note
                // Delete note if content is cleared
                const { error: noteError } = await supabase
                    .from('notes')
                    .delete()
                    .eq('id', existingNoteId);
                if (noteError) console.warn("Could not delete note:", noteError.message);
            }
        }
    
        const { data: finalLead, error: fetchError } = await supabase
            .from('leads')
            .select('*, notes(*), appointments(*)')
            .eq('id', updatedLead.id)
            .single();
    
        if (fetchError) throw new Error(fetchError.message);
    
        return finalLead as Lead;
    }

    static async updateLead(clientId: string, leadId: string, updates: Partial<Lead>): Promise<Lead> {
        // We don't need clientId for Supabase update, but keep it for consistency
        const { data, error } = await supabase.from('leads').update(updates).eq('id', leadId).select('*, notes(*), appointments(*)').single();
        if (error) throw new Error(error.message);
        return data as Lead;
    }

    static async getLeadById(leadId: string): Promise<Lead | null> {
        const { data, error } = await supabase
            .from('leads')
            .select('*, notes(*), appointments(*)')
            .eq('id', leadId)
            .single();
        if (error) {
            console.error(`Error fetching lead with id ${leadId}:`, error);
            return null;
        }
        return data as Lead;
    }

    static async deleteLead(clientId: string, leadId: string): Promise<void> {
        const { error } = await supabase.from('leads').delete().eq('id', leadId);
        if (error) throw new Error(error.message);
    }

    static async deleteMultipleLeads(leadsToDelete: {clientId: string, leadId: string}[]): Promise<void> {
        const leadIds = leadsToDelete.map(l => l.leadId);
        const { error } = await supabase.from('leads').delete().in('id', leadIds);
        if (error) throw new Error(error.message);
    }
    
    static async addNoteToLead(clientId: string, leadId: string, noteContent: string): Promise<Lead> {
        const { error } = await supabase.from('notes').insert({ lead_id: leadId, content: noteContent });
        if (error) throw new Error(error.message);
        
        // Fetch the lead again with the new note
        const { data: updatedLeadData, error: leadError } = await supabase
            .from('leads')
            .select('*, notes(*), appointments(*)')
            .eq('id', leadId)
            .single();
        if(leadError) throw new Error(leadError.message);
        
        return updatedLeadData as Lead;
    }

    static async updateNote(noteId: string, content: string): Promise<void> {
        const { error } = await supabase
            .from('notes')
            .update({ content })
            .eq('id', noteId);
        if (error) throw new Error(error.message);
    }

    static async deleteNote(noteId: string): Promise<void> {
        const { error } = await supabase
            .from('notes')
            .delete()
            .eq('id', noteId);
        if (error) throw new Error(error.message);
    }

    static async getUserById(userId: string): Promise<User | null> {
        const { data, error } = await supabase.from('users').select('*').eq('id', userId).single();
        if (error) return null;
        return data as User;
    }

    static async updateUser(userId: string, updates: Partial<Pick<User, 'username' | 'email' | 'phone'>>): Promise<User> {
        if (updates.username) {
            const { data: existing } = await supabase
                .from('users')
                .select('id')
                .eq('username', updates.username)
                .not('id', 'eq', userId)
                .single();
            if (existing) throw new Error('Username already exists.');
        }

        const { data: updatedUser, error: updateError } = await supabase
            .from('users')
            .update(updates)
            .eq('id', userId)
            .select('id, username, role, email, phone, status, created_at')
            .single();

        if (updateError) throw new Error(updateError.message);
        return updatedUser as User;
    }
    
    static async updateUserStatus(userId: string, status: User['status']): Promise<User> {
        const { data, error } = await supabase.from('users').update({ status }).eq('id', userId).select().single();
        if(error) throw new Error(error.message);
        const { password, ...userWithoutPassword } = data;
        return userWithoutPassword as User;
    }

    // --- Ad Spend Methods ---
    static async addAdSpend(clientId: string, spendData: Omit<AdSpend, 'id' | 'client_id' | 'created_at'>): Promise<AdSpend> {
        const { data, error } = await supabase
            .from('ad_spends')
            .insert({ client_id: clientId, ...spendData })
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data as AdSpend;
    }

    static async updateAdSpend(clientId: string, spendId: string, updates: Partial<Omit<AdSpend, 'id'>>): Promise<AdSpend> {
        const { data, error } = await supabase.from('ad_spends').update(updates).eq('id', spendId).select().single();
        if(error) throw new Error(error.message);
        return data as AdSpend;
    }

    static async deleteAdSpend(clientId: string, spendId: string): Promise<void> {
        const { error } = await supabase.from('ad_spends').delete().eq('id', spendId);
        if(error) throw new Error(error.message);
    }

    static async deleteMultipleAdSpends(clientId: string, spendIds: string[]): Promise<void> {
        if (spendIds.length === 0) return;
        const { error } = await supabase.from('ad_spends').delete().in('id', spendIds);
        if (error) throw new Error(error.message);
    }

    // --- Saved Form Methods ---
    static async getForms(): Promise<SavedForm[]> {
        const { data, error } = await supabase.from('saved_forms').select('*');
        if (error) throw new Error(error.message);
        return data as SavedForm[];
    }

    static async saveForm(form: Omit<SavedForm, 'id' | 'created_at'>): Promise<SavedForm> {
        const { data, error } = await supabase
            .from('saved_forms')
            .insert(form)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data as SavedForm;
    }

    static async updateForm(formId: string, updates: Partial<Omit<SavedForm, 'id' | 'created_at'>>): Promise<SavedForm> {
        const { data, error } = await supabase
            .from('saved_forms')
            .update(updates)
            .eq('id', formId)
            .select()
            .single();
        if (error) throw new Error(error.message);
        return data as SavedForm;
    }

    static async deleteForm(formId: string): Promise<void> {
        const { error } = await supabase.from('saved_forms').delete().eq('id', formId);
        if (error) throw new Error(error.message);
    }

    // --- Notification Methods ---
    static async getNotificationsForUser(userId: string, limit?: number): Promise<Notification[]> {
        let query = supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

        if (limit) {
            query = query.limit(limit);
        }
        
        const { data, error } = await query;
        
        if (error) throw new Error(error.message);
        return data as Notification[];
    }

    static async markNotificationAsRead(notificationId: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('id', notificationId);
        
        if (error) throw new Error(error.message);
    }

    static async markAllNotificationsAsRead(userId: string): Promise<void> {
        const { error } = await supabase
            .from('notifications')
            .update({ read: true })
            .eq('user_id', userId)
            .eq('read', false);

        if (error) throw new Error(error.message);
    }

    static async sendCustomNotification(userIds: string[], title: string, message: string): Promise<void> {
        if (!userIds || userIds.length === 0 || !message.trim() || !title.trim()) {
            throw new Error("User IDs, title, and message are required.");
        }

        const notificationsToInsert = userIds.map(userId => ({
            user_id: userId,
            title: title.trim(),
            message: message.trim(),
            read: false,
        }));

        const { error } = await supabase.from('notifications').insert(notificationsToInsert);
        if (error) {
            throw new Error(error.message);
        }
    }
    
    static async getSentNotifications(): Promise<Notification[]> {
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .is('lead_id', null)
            .not('title', 'is', null)
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(error.message);
        }

        // Group notifications by title, message, and a 1-minute time window to represent a "batch"
        const grouped = new Map<string, Notification>();
        const notifications = data || [];

        for (const notification of notifications) {
            const date = new Date(notification.created_at);
            const timeKey = `${date.getUTCFullYear()}-${date.getUTCMonth()}-${date.getUTCDate()}-${date.getUTCHours()}-${date.getUTCMinutes()}`;
            const groupKey = `${notification.title}|${notification.message}|${timeKey}`;
    
            if (!grouped.has(groupKey)) {
                grouped.set(groupKey, notification); // Store the first notification as a representative for the group
            }
        }
        
        return Array.from(grouped.values());
    }

    static async updateSentNotification(originalNotification: Notification, newTitle: string, newMessage: string): Promise<void> {
        const { title, message, created_at } = originalNotification;
    
        const date = new Date(created_at);
        const startTime = new Date(date.getTime());
        startTime.setUTCSeconds(0, 0);
        const endTime = new Date(date.getTime());
        endTime.setUTCSeconds(59, 999);
    
        // 1. Identify the original batch and get recipient IDs
        const { data: originalBatch, error: fetchError } = await supabase
            .from('notifications')
            .select('user_id')
            .is('lead_id', null)
            .eq('title', title)
            .eq('message', message)
            .gte('created_at', startTime.toISOString())
            .lte('created_at', endTime.toISOString());
    
        if (fetchError) {
            throw new Error(`Could not retrieve original notifications: ${fetchError.message}`);
        }
    
        if (!originalBatch || originalBatch.length === 0) {
            console.warn("No notifications found for the group to update.");
            return;
        }
    
        const recipientUserIds = [...new Set(originalBatch.map(n => n.user_id))];
    
        // 2. Delete the original batch
        const { error: deleteError } = await supabase
            .from('notifications')
            .delete()
            .is('lead_id', null)
            .eq('title', title)
            .eq('message', message)
            .gte('created_at', startTime.toISOString())
            .lte('created_at', endTime.toISOString());
    
        if (deleteError) {
            throw new Error(`Could not delete original notifications: ${deleteError.message}`);
        }
    
        // 3. Create and re-send the new batch
        if (recipientUserIds.length > 0) {
            const notificationsToInsert = recipientUserIds.map(userId => ({
                user_id: userId,
                title: newTitle.trim(),
                message: newMessage.trim(),
                read: false,
            }));
            
            const { error: insertError } = await supabase.from('notifications').insert(notificationsToInsert);
            if (insertError) {
                throw new Error(`Could not resend new notifications: ${insertError.message}`);
            }
        }
    }

    static async deleteSentNotification(notificationToDelete: Notification): Promise<void> {
        const { title, message, created_at } = notificationToDelete;
    
        const date = new Date(created_at);
        const startTime = new Date(date.getTime());
        startTime.setUTCSeconds(0, 0);
        const endTime = new Date(date.getTime());
        endTime.setUTCSeconds(59, 999);

        const { error } = await supabase
            .from('notifications')
            .delete()
            .is('lead_id', null)
            .eq('title', title)
            .eq('message', message)
            .gte('created_at', startTime.toISOString())
            .lte('created_at', endTime.toISOString());

        if (error) {
            throw new Error(error.message);
        }
    }

    // --- MWS Revenue Methods ---
    static async getMwsMonthlyRevenues(clientId?: string): Promise<MwsMonthlyRevenue[]> {
        let query = supabase.from('mws_monthly_revenue').select('*');
        if (clientId) {
            query = query.eq('client_id', clientId);
        }
        const { data, error } = await query;
        if (error) throw new Error(error.message);
        return data as MwsMonthlyRevenue[];
    }

    static async upsertMwsRevenue(revenueData: Omit<MwsMonthlyRevenue, 'id' | 'created_at' | 'updated_at'>): Promise<MwsMonthlyRevenue> {
        const { data, error } = await supabase
            .from('mws_monthly_revenue')
            .upsert(revenueData, { onConflict: 'client_id, month' })
            .select()
            .single();
        
        if (error) throw new Error(error.message);
        return data as MwsMonthlyRevenue;
    }
    
    // --- Quote Methods ---
    static async getQuotesForLead(leadId: string): Promise<Quote[]> {
        const { data, error } = await supabase.rpc('get_quotes_for_lead', {
            p_lead_id: leadId
        });

        if (error) {
            console.error("Error fetching quotes for lead via RPC:", error.message);
            return [];
        }
        return data as Quote[];
    }
    
    static async getAllQuotes(): Promise<QuoteWithDetails[]> {
        const { data, error } = await supabase.rpc('get_all_quotes_with_details');

        if (error) {
            console.error("Error fetching all quotes via RPC:", error);
            throw new Error(error.message);
        }
        return (data || []) as QuoteWithDetails[];
    }

    static async saveQuote(quoteData: Omit<Quote, 'id' | 'created_at' | 'status'>): Promise<Quote> {
        const { data, error } = await supabase.rpc('create_quote', {
            quote_data: quoteData
        });
        
        if (error) {
            console.error('RPC create_quote error:', JSON.stringify(error, null, 2));
            throw new Error(`Errore RPC: ${error.message}. Dettagli: ${error.details || 'N/D'}`);
        }

        return data as Quote;
    }

    static async updateQuote(quoteId: string, quoteData: Partial<Omit<Quote, 'id' | 'created_at'>>): Promise<Quote> {
        const { data, error } = await supabase.rpc('update_quote', {
            p_quote_id: quoteId,
            quote_data: quoteData
        });
        
        if (error) {
            console.error('RPC update_quote error:', JSON.stringify(error, null, 2));
            throw new Error(`Errore RPC: ${error.message}. Dettagli: ${error.details || 'N/D'}`);
        }

        return data as Quote;
    }

    static async updateQuoteStatus(quoteId: string, status: Quote['status']): Promise<void> {
        // 1. Perform all DB updates using the RLS-bypassing RPC.
        const { error: rpcError } = await supabase.rpc('update_quote_status_and_handle_accepted', {
            p_quote_id: quoteId,
            p_new_status: status
        });
    
        if (rpcError) {
            console.error('RPC "update_quote_status_and_handle_accepted" error:', JSON.stringify(rpcError, null, 2));
            throw new Error(`Failed to update quote status: ${rpcError.message} (Details: ${rpcError.details || 'N/D'})`);
        }
    
        // 2. If status is 'accepted' and RPC was successful, send webhook from the client-side.
        if (status === 'accepted') {
            try {
                // 2a. Get webhook data using another RLS-bypassing RPC. This is needed for admins.
                const { data: webhookData, error: webhookInfoError } = await supabase.rpc('get_webhook_data_for_quote', {
                    p_quote_id: quoteId
                });
    
                if (webhookInfoError) {
                    console.warn('Could not retrieve webhook info (this is expected if no webhook is configured):', webhookInfoError.message);
                    return; // Don't throw, main operation succeeded
                }
    
                const webhookInfo = Array.isArray(webhookData) ? webhookData[0] : webhookData;
    
                if (webhookInfo && webhookInfo.webhook_url && webhookInfo.quote_data) {
                    // The RPC returns the full quote data, including the 'items' field as raw JSON.
                    // This avoids a separate, RLS-affected call to getQuoteById which was failing.
                    const quotePayloadForWebhook = {
                        ...webhookInfo.quote_data,
                        // Ensure items is at least an empty array, using the data from the RPC.
                        items: webhookInfo.quote_data.items || [], 
                    };
                    
                    // 2b. Send the webhook
                    const response = await fetch(webhookInfo.webhook_url, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            event: 'quote_accepted',
                            quote: quotePayloadForWebhook,
                        }),
                    });
    
                    if (!response.ok) {
                        // Log but don't throw, as the main DB operations succeeded
                        console.error(`Webhook failed with status ${response.status}: ${await response.text()}`);
                    }
                }
            } catch (webhookError: any) {
                // Catch any other errors during the webhook process
                console.error(`Error sending webhook: ${webhookError.message}`);
            }
        }
    }

    static async sendQuoteByWebhook(quoteId: string): Promise<void> {
        try {
            // 1. Get webhook data using the existing RLS-bypassing RPC.
            const { data: webhookData, error: webhookInfoError } = await supabase.rpc('get_webhook_data_for_quote', {
                p_quote_id: quoteId
            });
    
            if (webhookInfoError) {
                console.warn('Could not retrieve webhook info (this is expected if no webhook is configured):', webhookInfoError.message);
                throw new Error(`Impossibile recuperare i dati per l'invio: ${webhookInfoError.message}`);
            }
    
            const webhookInfo = Array.isArray(webhookData) ? webhookData[0] : webhookData;
    
            if (webhookInfo && webhookInfo.webhook_url && webhookInfo.quote_data) {
                const quotePayloadForWebhook = {
                    ...webhookInfo.quote_data,
                    items: webhookInfo.quote_data.items || [], 
                };
                
                // 2. Send the webhook with a specific event type
                const response = await fetch(webhookInfo.webhook_url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        event: 'quote_sent_by_email', // New event type
                        quote: quotePayloadForWebhook,
                    }),
                });
    
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`Webhook failed with status ${response.status}: ${errorText}`);
                    throw new Error(`Il server webhook ha risposto con un errore: ${response.status}`);
                }
    
                // 3. After successfully sending, update the quote status to 'sent' if it's not already 'accepted'.
                if (quotePayloadForWebhook.status !== 'accepted') {
                    await this.updateQuoteStatus(quoteId, 'sent');
                }
            } else {
                throw new Error("URL webhook non configurato per questo cliente o dati preventivo non trovati.");
            }
        } catch (error: any) {
            console.error(`Error sending quote by webhook: ${error.message}`);
            // Re-throw the error so the UI can catch it.
            throw error;
        }
    }

    static async deleteQuote(quoteId: string): Promise<void> {
        const { error } = await supabase.rpc('delete_quote', {
            p_quote_id: quoteId
        });

        if (error) {
            console.error('RPC delete_quote error:', JSON.stringify(error, null, 2));
            throw new Error(`Errore RPC: ${error.message}. Dettagli: ${error.details || 'N/D'}`);
        }
    }

    static async getQuoteById(quoteId: string): Promise<Quote> {
        const { data, error } = await supabase
            .from('quotes')
            .select('*')
            .eq('id', quoteId);
        if (error) throw new Error(error.message);
        if (!data || data.length === 0) throw new Error(`Quote with id ${quoteId} not found.`);
        // Handle cases where a non-unique ID might return multiple rows.
        return data[0] as Quote;
    }

    // --- Appointment Methods ---
    static async addAppointment(appointmentData: Omit<Appointment, 'id' | 'created_at'>): Promise<Lead> {
        const { error: appointmentError } = await supabase
            .from('appointments')
            .insert(appointmentData);
        
        if (appointmentError) throw new Error(appointmentError.message);
    
        // Re-fetch the lead to get the updated list of appointments
        const { data: updatedLead, error: leadError } = await supabase
            .from('leads')
            .select('*, notes(*), appointments(*)').eq('id', appointmentData.lead_id)
            .single();
        
        if (leadError) throw new Error(leadError.message);
    
        return updatedLead as Lead;
    }

    static async addGeneralAppointment(appointmentData: Omit<Appointment, 'id' | 'created_at' | 'lead_id' | 'client_id'>): Promise<void> {
        const { error } = await supabase
            .from('appointments')
            .insert(appointmentData);

        if (error) throw new Error(error.message);
    }
    
    static async updateAppointment(appointmentId: string, updates: Partial<Omit<Appointment, 'id' | 'created_at'>>): Promise<void> {
        const { error } = await supabase
            .from('appointments')
            .update(updates)
            .eq('id', appointmentId);

        if (error) throw new Error(error.message);
    }

    static async deleteAppointment(appointmentId: string): Promise<void> {
        const { error } = await supabase.from('appointments').delete().eq('id', appointmentId);
        if (error) throw new Error(error.message);
    }

    static async getAppointmentsForCalendar(): Promise<CalendarAppointment[]> {
        const { data, error } = await supabase
            .from('appointments')
            .select(`
                *,
                leads (*, notes(*), quotes(*)),
                clients (name, user_id)
            `)
            .order('appointment_date', { ascending: false })
            .order('appointment_time', { ascending: false });

        if (error) {
            console.error("Error fetching appointments for calendar:", error);
            throw new Error(error.message);
        }
        return data as CalendarAppointment[];
    }

    static async broadcastForceLogout(userId: string): Promise<void> {
        const channel = supabase.channel('force-logout');
        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'logout',
                    payload: { userId },
                });
                supabase.removeChannel(channel);
            }
        });
    }
}
