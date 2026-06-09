-- ============================================================
-- MWS Lead Manager — RESET COMPLETO + SCHEMA V2
-- Esegui questo script nel SQL Editor di Supabase
-- ATTENZIONE: cancella TUTTI i dati esistenti
-- ============================================================

-- 1. DROP di tutte le tabelle esistenti (in ordine per rispettare i FK)
DROP TABLE IF EXISTS public.mws_monthly_revenue CASCADE;
DROP TABLE IF EXISTS public.saved_forms CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.ad_spends CASCADE;
DROP TABLE IF EXISTS public.appointments CASCADE;
DROP TABLE IF EXISTS public.quotes CASCADE;
DROP TABLE IF EXISTS public.notes CASCADE;
DROP TABLE IF EXISTS public.leads CASCADE;
DROP TABLE IF EXISTS public.clients CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- 2. Drop dei trigger e funzioni esistenti
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();

-- ============================================================
-- SCHEMA V2 — Nessuna colonna password, tutto su Supabase Auth
-- ============================================================

-- Estensioni
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABELLA USERS
-- Collegata a auth.users — NON contiene password
-- ============================================================
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username VARCHAR(255) NOT NULL UNIQUE,
    role VARCHAR(50) NOT NULL DEFAULT 'client' CHECK (role IN ('admin', 'client')),
    email VARCHAR(255),
    phone VARCHAR(50),
    status VARCHAR(50) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo agli utenti"
ON public.users FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Utente: legge il proprio profilo"
ON public.users FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Utente: aggiorna il proprio profilo"
ON public.users FOR UPDATE
USING (auth.uid() = id);


-- ============================================================
-- TABELLA CLIENTS
-- ============================================================
CREATE TABLE public.clients (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    services JSONB NOT NULL DEFAULT '[]'::jsonb,
    quote_webhook_url TEXT,
    whatsapp_templates JSONB DEFAULT '[]'::jsonb,
    api_token UUID NOT NULL DEFAULT uuid_generate_v4(), -- token univoco per ricezione lead da form/API esterne
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo ai clienti"
ON public.clients FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: vede solo il proprio account"
ON public.clients FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Client: aggiorna le proprie impostazioni"
ON public.clients FOR UPDATE
USING (user_id = auth.uid());


-- ============================================================
-- TABELLA LEADS
-- ============================================================
CREATE TABLE public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'Nuovo' CHECK (status IN ('Nuovo', 'Contattato', 'In Lavorazione', 'Perso', 'Vinto')),
    value NUMERIC(12,2) DEFAULT 0,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_leads_client_id ON public.leads(client_id);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_created_at ON public.leads(created_at);

ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo alle lead"
ON public.leads FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: legge solo le proprie lead"
ON public.leads FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Client: aggiorna solo le proprie lead"
ON public.leads FOR UPDATE
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()))
WITH CHECK (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));


-- ============================================================
-- TABELLA NOTES
-- ============================================================
CREATE TABLE public.notes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo alle note"
ON public.notes FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: accede alle note delle proprie lead"
ON public.notes FOR ALL
USING (lead_id IN (
    SELECT l.id FROM public.leads l
    JOIN public.clients c ON l.client_id = c.id
    WHERE c.user_id = auth.uid()
));


-- ============================================================
-- TABELLA QUOTES
-- ============================================================
CREATE TABLE public.quotes (
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
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo ai preventivi"
ON public.quotes FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: gestisce solo i propri preventivi"
ON public.quotes FOR ALL
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));


-- ============================================================
-- TABELLA APPOINTMENTS
-- ============================================================
CREATE TABLE public.appointments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
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

CREATE POLICY "Admin: accesso completo agli appuntamenti"
ON public.appointments FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: gestisce solo i propri appuntamenti"
ON public.appointments FOR ALL
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));


-- ============================================================
-- TABELLA AD_SPENDS
-- ============================================================
CREATE TABLE public.ad_spends (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    service VARCHAR(255) NOT NULL,
    platform VARCHAR(50) NOT NULL CHECK (platform IN ('Meta', 'Google', 'TikTok')),
    amount NUMERIC(10,2) NOT NULL DEFAULT 0,
    date DATE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.ad_spends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: gestisce liberamente i costi pubblicitari"
ON public.ad_spends FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: legge i propri costi pubblicitari"
ON public.ad_spends FOR SELECT
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));


-- ============================================================
-- TABELLA NOTIFICATIONS
-- ============================================================
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title VARCHAR(255),
    message TEXT NOT NULL,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo alle notifiche"
ON public.notifications FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Utente: gestisce solo le proprie notifiche"
ON public.notifications FOR ALL
USING (user_id = auth.uid());


-- ============================================================
-- TABELLA SAVED_FORMS
-- ============================================================
CREATE TABLE public.saved_forms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    service_name VARCHAR(255),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.saved_forms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo ai form salvati"
ON public.saved_forms FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));

CREATE POLICY "Client: gestisce solo i propri form"
ON public.saved_forms FOR ALL
USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));


-- ============================================================
-- TABELLA MWS_MONTHLY_REVENUE
-- ============================================================
CREATE TABLE public.mws_monthly_revenue (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    month DATE NOT NULL,
    revenue_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(50) NOT NULL DEFAULT 'unpaid' CHECK (status IN ('paid', 'unpaid', 'partially_paid')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(client_id, month)
);

ALTER TABLE public.mws_monthly_revenue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin: accesso completo ai ricavi MWS"
ON public.mws_monthly_revenue FOR ALL
USING (EXISTS (
    SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'
));


-- ============================================================
-- TRIGGER: crea il profilo in public.users quando si registra
-- un nuovo utente tramite Supabase Auth
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, username, role, email, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'username', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'client'),
        NEW.email,
        'active'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        username = COALESCE(EXCLUDED.username, public.users.username);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ============================================================
-- FUNZIONI RPC (necessarie per l'app)
-- ============================================================

-- Drop delle funzioni esistenti prima di ricrearle
DROP FUNCTION IF EXISTS public.get_all_quotes_with_details() CASCADE;
DROP FUNCTION IF EXISTS public.get_quotes_for_lead(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.create_quote(JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.update_quote(UUID, JSONB) CASCADE;
DROP FUNCTION IF EXISTS public.update_quote_status_and_handle_accepted(UUID, VARCHAR) CASCADE;
DROP FUNCTION IF EXISTS public.get_webhook_data_for_quote(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.delete_quote(UUID) CASCADE;

-- Recupera tutti i preventivi con dettagli cliente e lead
CREATE OR REPLACE FUNCTION public.get_all_quotes_with_details()
RETURNS TABLE (
    id UUID, client_id UUID, lead_id UUID, quote_number_display VARCHAR,
    quote_date DATE, due_date DATE, recipient_name VARCHAR, payment_type VARCHAR,
    notes TEXT, taxable_amount NUMERIC, vat_amount NUMERIC, total_amount NUMERIC,
    status VARCHAR, items JSONB, created_at TIMESTAMPTZ,
    clients JSON, leads JSON
)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT
        q.id, q.client_id, q.lead_id, q.quote_number_display,
        q.quote_date, q.due_date, q.recipient_name, q.payment_type,
        q.notes, q.taxable_amount, q.vat_amount, q.total_amount,
        q.status, q.items, q.created_at,
        json_build_object('id', c.id, 'name', c.name) AS clients,
        json_build_object('id', l.id, 'data', l.data) AS leads
    FROM public.quotes q
    LEFT JOIN public.clients c ON q.client_id = c.id
    LEFT JOIN public.leads l ON q.lead_id = l.id
    ORDER BY q.created_at DESC;
END;
$$;

-- Recupera preventivi per una lead specifica
CREATE OR REPLACE FUNCTION public.get_quotes_for_lead(p_lead_id UUID)
RETURNS SETOF public.quotes
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY SELECT * FROM public.quotes WHERE lead_id = p_lead_id ORDER BY created_at DESC;
END;
$$;

-- Crea un preventivo
CREATE OR REPLACE FUNCTION public.create_quote(quote_data JSONB)
RETURNS public.quotes
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    new_quote public.quotes;
BEGIN
    INSERT INTO public.quotes (
        client_id, lead_id, quote_number_display, quote_date, due_date,
        recipient_name, payment_type, notes, taxable_amount, vat_amount,
        total_amount, status, items
    ) VALUES (
        (quote_data->>'client_id')::UUID,
        (quote_data->>'lead_id')::UUID,
        quote_data->>'quote_number_display',
        (quote_data->>'quote_date')::DATE,
        (quote_data->>'due_date')::DATE,
        quote_data->>'recipient_name',
        quote_data->>'payment_type',
        quote_data->>'notes',
        (quote_data->>'taxable_amount')::NUMERIC,
        (quote_data->>'vat_amount')::NUMERIC,
        (quote_data->>'total_amount')::NUMERIC,
        'draft',
        COALESCE(quote_data->'items', '[]'::jsonb)
    )
    RETURNING * INTO new_quote;
    RETURN new_quote;
END;
$$;

-- Aggiorna un preventivo
CREATE OR REPLACE FUNCTION public.update_quote(p_quote_id UUID, quote_data JSONB)
RETURNS public.quotes
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    updated_quote public.quotes;
BEGIN
    UPDATE public.quotes SET
        quote_number_display = COALESCE(quote_data->>'quote_number_display', quote_number_display),
        quote_date           = COALESCE((quote_data->>'quote_date')::DATE, quote_date),
        due_date             = COALESCE((quote_data->>'due_date')::DATE, due_date),
        recipient_name       = COALESCE(quote_data->>'recipient_name', recipient_name),
        payment_type         = COALESCE(quote_data->>'payment_type', payment_type),
        notes                = COALESCE(quote_data->>'notes', notes),
        taxable_amount       = COALESCE((quote_data->>'taxable_amount')::NUMERIC, taxable_amount),
        vat_amount           = COALESCE((quote_data->>'vat_amount')::NUMERIC, vat_amount),
        total_amount         = COALESCE((quote_data->>'total_amount')::NUMERIC, total_amount),
        items                = COALESCE(quote_data->'items', items)
    WHERE id = p_quote_id
    RETURNING * INTO updated_quote;
    RETURN updated_quote;
END;
$$;

-- Aggiorna lo stato di un preventivo
CREATE OR REPLACE FUNCTION public.update_quote_status_and_handle_accepted(p_quote_id UUID, p_new_status VARCHAR)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    UPDATE public.quotes SET status = p_new_status WHERE id = p_quote_id;

    IF p_new_status = 'accepted' THEN
        UPDATE public.leads SET status = 'Vinto'
        WHERE id = (SELECT lead_id FROM public.quotes WHERE id = p_quote_id);
    END IF;
END;
$$;

-- Recupera dati webhook per un preventivo
CREATE OR REPLACE FUNCTION public.get_webhook_data_for_quote(p_quote_id UUID)
RETURNS TABLE(webhook_url TEXT, quote_data JSONB)
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    RETURN QUERY
    SELECT c.quote_webhook_url, to_jsonb(q.*)
    FROM public.quotes q
    JOIN public.clients c ON q.client_id = c.id
    WHERE q.id = p_quote_id;
END;
$$;

-- Elimina un preventivo
CREATE OR REPLACE FUNCTION public.delete_quote(p_quote_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    DELETE FROM public.quotes WHERE id = p_quote_id;
END;
$$;
