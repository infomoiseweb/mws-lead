-- SCHEMA DATABASE MULTI-TENANT PER MWS GESTIONE LEAD
-- Integra Supabase Auth e Row Level Security (RLS) rigido per i dati sensibili dei clienti.

-- Abilitazione estensioni necessarie
create extension if not exists "uuid-ossp";

-- 1. Tabella USERS (Profili collegati direttamente a Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Abilitiamo RLS su public.users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Criteri RLS per public.users
CREATE POLICY "Gli amministratori possono fare tutto sui profili" 
ON public.users FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "Gli utenti possono leggere il proprio profilo" 
ON public.users FOR SELECT 
USING (auth.uid() = id);

CREATE POLICY "Gli utenti possono aggiornare il proprio profilo" 
ON public.users FOR UPDATE 
USING (auth.uid() = id);


-- 2. Tabella CLIENTS (Clienti di MWS - Nicchie differenziate)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    services JSONB NOT NULL DEFAULT '[]'::jsonb, -- Configurazione personalizzata delle nicchie / servizi
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    quote_webhook_url TEXT,
    whatsapp_templates JSONB DEFAULT '[]'::jsonb -- Template messaggi WhatsApp personalizzati per nicchia
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Criteri RLS per public.clients
CREATE POLICY "Gli amministratori possono fare tutto sui clienti" 
ON public.clients FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "I clienti possono visualizzare solo il proprio account" 
ON public.clients FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "I clienti possono aggiornare le proprie impostazioni/whatsapp_templates" 
ON public.clients FOR UPDATE 
USING (user_id = auth.uid());


-- 3. Tabella LEADS (Anagrafica lead, campi dinamici in JSONB)
CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Nuovo' CHECK (status IN ('Nuovo', 'Contattato', 'In Lavorazione', 'Perso', 'Vinto')),
    value NUMERIC(12,2) DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}'::jsonb, -- Dati flessibili del formulario (WP, HTML, ecc.)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indici per ottimizzazione delle query di lead multi-tenant
CREATE INDEX IF NOT EXISTS idx_leads_client_id ON public.leads(client_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- Criteri RLS per public.leads
CREATE POLICY "Gli amministratori di MWS leggono e scrivono tutti i lead" 
ON public.leads FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "I clienti leggono solo i propri lead" 
ON public.leads FOR SELECT 
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);

CREATE POLICY "I clienti aggiornano solo i propri lead" 
ON public.leads FOR UPDATE 
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
)
WITH CHECK (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);


-- 4. Tabella NOTES (Note storiche associate a ciascun lead)
CREATE TABLE IF NOT EXISTS public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori hanno accesso libero alle note" 
ON public.notes FOR ALL 
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "I clienti accedono alle note dei propri lead" 
ON public.notes FOR ALL 
USING (
    lead_id IN (
        SELECT l.id FROM public.leads l
        JOIN public.clients c ON l.client_id = c.id
        WHERE c.user_id = auth.uid()
    )
);


-- 5. Tabella QUOTES (Preventivi personalizzati emessi)
CREATE TABLE IF NOT EXISTS public.quotes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    quote_number_display VARCHAR(100) NOT NULL,
    quote_date DATE NOT NULL DEFAULT CURRENT_DATE,
    due_date DATE,
    recipient_name VARCHAR(255) NOT NULL,
    payment_type VARCHAR(100),
    notes TEXT,
    taxable_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    vat_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    total_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected')),
    items JSONB NOT NULL DEFAULT '[]'::jsonb, -- Dettaglio righe preventivo
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori hanno accesso completo ai preventivi"
ON public.quotes FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "I clienti gestiscono solo i propri preventivi"
ON public.quotes FOR ALL
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);


-- 6. Tabella APPOINTMENTS (Appuntamenti pianificati)
CREATE TABLE IF NOT EXISTS public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    appointment_date DATE NOT NULL,
    appointment_time TIME NOT NULL,
    duration_hours NUMERIC(4,2) DEFAULT 1,
    title VARCHAR(255),
    notes TEXT,
    labor_cost NUMERIC(12,2) DEFAULT 0,
    parts_cost NUMERIC(12,2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori hanno accesso completo agli appuntamenti"
ON public.appointments FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "I clienti gestiscono solo i propri appuntamenti"
ON public.appointments FOR ALL
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);


-- 7. Tabella AD_SPENDS (Investimenti pubblicitari delle campagne Meta/Google)
CREATE TABLE IF NOT EXISTS public.ad_spends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('Meta', 'Google', 'TikTok')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ad_spends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Amministratori gestiscono liberamente i costi pubblicitari"
ON public.ad_spends FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE public.users.id = auth.uid() AND public.users.role = 'admin'
    )
);

CREATE POLICY "I clienti leggono i propri costi pubblicitari"
ON public.ad_spends FOR SELECT
USING (
    client_id IN (
        SELECT id FROM public.clients WHERE user_id = auth.uid()
    )
);


-- 8. TRIGGER DI SINCRONIZZAZIONE AUTOMATICA UTENTI DA SUPABASE AUTH
-- Quando un utente si registra o viene creato via Supabase Auth,
-- creiamo automaticamente la riga corrispondente in public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username, role, email, status)
    VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', new.email),
        COALESCE(new.raw_user_meta_data->>'role', 'client'),
        new.email,
        'active'
    )
    ON CONFLICT (id) DO UPDATE 
    SET email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.users.username);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Creazione effettiva del trigger su auth.users (da eseguire come superuser)
-- CREATE TRIGGER on_auth_user_created
-- AFTER INSERT ON auth.users
-- FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
