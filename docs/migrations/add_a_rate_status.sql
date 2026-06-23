-- Aggiunge lo stato "A Rate" alle lead
-- Eseguire dopo add_preventivo_accettato_status.sql

ALTER TABLE public.leads
    DROP CONSTRAINT IF EXISTS leads_status_check;

ALTER TABLE public.leads
    ADD CONSTRAINT leads_status_check CHECK (
        status IN (
            'Nuovo',
            'Contattato',
            'In Lavorazione',
            'Perso',
            'Vinto',
            'Preventivo Inviato',
            'Preventivo Accettato',
            'Preventivo Rifiutato',
            'A Rate'
        )
    );
