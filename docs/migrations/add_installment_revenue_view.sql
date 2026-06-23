-- Vista: fatturato mensile da rate pagate
-- Usata per integrare le rate nel calcolo del revenue mensile

CREATE OR REPLACE VIEW public.installment_revenue_by_month AS
SELECT
    pp.client_id,
    TO_CHAR(i.paid_at, 'YYYY-MM') AS month,
    SUM(i.amount)::decimal(10,2)  AS total_paid
FROM public.installments i
JOIN public.payment_plans pp ON pp.id = i.payment_plan_id
WHERE i.paid_at IS NOT NULL
GROUP BY pp.client_id, TO_CHAR(i.paid_at, 'YYYY-MM');
