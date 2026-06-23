-- Piani di pagamento a rate collegati alle lead

CREATE TABLE IF NOT EXISTS public.payment_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    lead_id UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
    quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.installments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_plan_id UUID NOT NULL REFERENCES public.payment_plans(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    due_date DATE NOT NULL,
    paid_at DATE DEFAULT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indici
CREATE INDEX IF NOT EXISTS idx_payment_plans_client ON public.payment_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_payment_plans_lead ON public.payment_plans(lead_id);
CREATE INDEX IF NOT EXISTS idx_installments_plan ON public.installments(payment_plan_id);

-- RLS
ALTER TABLE public.payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;

-- Admin vede tutto
CREATE POLICY "Admin full access payment_plans" ON public.payment_plans
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admin full access installments" ON public.installments
    FOR ALL USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin'));

-- Client vede solo i propri
CREATE POLICY "Client own payment_plans" ON public.payment_plans
    FOR ALL USING (client_id IN (SELECT id FROM public.clients WHERE user_id = auth.uid()));

CREATE POLICY "Client own installments" ON public.installments
    FOR ALL USING (payment_plan_id IN (
        SELECT pp.id FROM public.payment_plans pp
        JOIN public.clients c ON c.id = pp.client_id
        WHERE c.user_id = auth.uid()
    ));

-- Colonna per abilitare rate per cliente
ALTER TABLE public.clients
    ADD COLUMN IF NOT EXISTS installments_enabled boolean NOT NULL DEFAULT false;
