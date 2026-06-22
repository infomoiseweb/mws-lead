export type AdSpendPlatform = 'Meta' | 'Google' | 'TikTok';

export interface AdSpend {
    id: string;
    client_id?: string;
    service: string;
    platform: AdSpendPlatform;
    amount: number;
    date: string; // YYYY-MM-DD (start date)
    created_at?: string;
}

export interface User {
    id: string;
    username: string;
    password?: string;
    role: 'admin' | 'client';
    email?: string;
    phone?: string;
    status: 'active' | 'suspended';
    created_at?: string;
}

export interface Notification {
    id: string;
    user_id: string;
    title?: string;
    message: string;
    read: boolean;
    created_at: string;
    lead_id?: string;
    client_id?: string;
}

export interface Note {
    id: string;
    lead_id?: string;
    content: string;
    created_at: string;
}

export type LeadFieldType =
  | 'text'
  | 'email'
  | 'textarea'
  | 'url'
  | 'tel'
  | 'radio'
  | 'select'
  | 'checkbox'
  | 'number'
  | 'date'
  | 'time'
  | 'file'
  | 'password';

export interface LeadField {
    id: string;
    name: string;
    label: string;
    type: LeadFieldType;
    options?: string[];
    required?: boolean;
}

export interface Service {
    id:string;
    name: string;
    fields: LeadField[];
    intake_mode?: 'form' | 'api';
    // True for the "base" service whose fields are shared/inherited by all other services
    is_base?: boolean;
}

export interface QuoteItem {
    id: string; // For React keys
    description: string;
    quantity: number;
    price: number;
    vat: number; // percentage, e.g., 22
}

export interface Quote {
    id: string;
    created_at: string;
    client_id: string;
    lead_id: string;
    quote_number_display: string;
    quote_date: string; // YYYY-MM-DD
    recipient_name: string;
    vehicle_details: Record<string, string>;
    payment_type: string;
    notes: string;
    description?: string;
    due_date: string; // YYYY-MM-DD
    taxable_amount: number;
    vat_amount: number;
    total_amount: number;
    status: 'draft' | 'sent' | 'accepted' | 'rejected';
    items: QuoteItem[] | Record<string, string>;
    terms_and_conditions?: string;
    extra_fields?: Record<string, string>;
}

export interface QuoteWithDetails extends Quote {
    clients: Pick<Client, 'id' | 'name'> | null;
    leads: Pick<Lead, 'id' | 'data'> | null;
}

export interface Appointment {
    id: string;
    created_at: string;
    lead_id?: string;
    client_id?: string;
    user_id?: string;
    appointment_date: string; // YYYY-MM-DD
    appointment_time: string; // HH:MM
    duration_hours: number;
    title?: string;
    notes?: string;
    labor_cost?: number;
    parts_cost?: number;
    location_address?: string;
    location_lat?: number;
    location_lng?: number;
}

export interface Lead {
    id: string;
    client_id?: string;
    created_at: string;
    data: Record<string, string>;
    status: 'Nuovo' | 'Contattato' | 'In Lavorazione' | 'Perso' | 'Vinto' | 'Preventivo Inviato' | 'Preventivo Accettato';
    value?: number;
    service?: string;
    notes?: Note[];
    quotes?: Quote[];
    appointments?: Appointment[];
}

// Variabili disponibili nei template: {{nome}}, {{telefono}}, {{email}}, {{servizio}}, {{data}}, + qualsiasi campo della lead
export interface MessageTemplate {
    id: string;
    name: string;               // Es. "Prima risposta irrorazione"
    service: string;            // Nome del servizio o "*" per tutti
    channel: 'whatsapp' | 'email' | 'entrambi';
    body: string;               // Testo con segnaposto {{nome}}, {{telefono}}, ecc.
}

export interface QuotePricePreset {
    id: string;
    service: string; // Nome del servizio o "*" per tutti
    label: string;   // Es. "Irrorazione campi"
    description: string; // Testo che finirà nella riga del preventivo
    unit: string;    // Es. "ettaro", "mq", "ora"
    price: number;
    vat: number;
    children?: QuotePricePreset[]; // Sotto-voci — se presente, questo preset è una categoria
}

export interface QuoteNumberingSettings {
    enabled: boolean;
    next_number: string; // Valore alfanumerico completo, es. "C6"
}

export interface QuoteBranding {
    logo_url?: string;
    brand_name?: string;      // nome azienda mostrato nell'intestazione quando manca il logo
    primary_color?: string;   // hex, es. "#2563eb" — usato per intestazioni/accenti
    font?: 'sans' | 'serif' | 'mono'; // famiglia font del documento preventivo
    company_details?: string; // testo libero multi-riga: indirizzo, P.IVA, contatti
}

export interface QuoteTermsPreset {
    id: string;
    service: string; // Nome del servizio o "*" per tutti
    label: string;
    text: string;
}

export interface QuoteShareMessageSettings {
    // Se false, il messaggio WhatsApp/Email non includerà il link per scaricare il PDF
    include_pdf_link?: boolean;
    // Template personalizzabili per l'invio del preventivo (placeholder: {{nome}}, {{numero}}, {{azienda}}, {{link_pdf}})
    email_subject_template?: string;
    email_body_template?: string;
    whatsapp_message_template?: string;
}

export interface QuoteSettings {
    numbering?: QuoteNumberingSettings;
    price_presets?: QuotePricePreset[];
    branding?: QuoteBranding;
    terms_presets?: QuoteTermsPreset[];
    // Nomi dei campi lead (lead.data) da includere automaticamente nei nuovi preventivi
    default_extra_fields?: string[];
    share_message?: QuoteShareMessageSettings;
    // Giorni di validità del preventivo: usati per impostare automaticamente la data di scadenza alla creazione
    validity_days?: number;
}

export interface Client {
    id: string;
    name: string;
    user_id: string;
    services: Service[];
    created_at?: string;
    mws_fixed_fee?: number;
    mws_profit_percentage?: number;
    quote_webhook_url?: string;
    message_templates?: MessageTemplate[];
    quote_settings?: QuoteSettings;
    marketing_settings?: MailMarketingSettings;
    mail_marketing_enabled?: boolean;
    lead_intake_mode?: 'form' | 'api';
    api_token?: string;
    can_delete_leads?: boolean;
    // These are loaded separately
    leads: Lead[];
    adSpends?: AdSpend[];
}

// ============================================================
// Mail Marketing
// ============================================================

export interface MailBranding {
    logo_url?: string;
    brand_name?: string;
    primary_color?: string;
    secondary_color?: string;
    footer_text?: string;
}

export interface MailMarketingSettings {
    branding?: MailBranding;
    // Nome mostrato come mittente, es. "Mario Rossi" in "Mario Rossi <noreply@dominio.it>"
    sender_name?: string;
    // Dominio verificato su Resend usato per l'invio (es. "mail.clientedomain.it")
    verified_domain?: string;
}

export interface MailDomainDnsRecord {
    record: string;
    name: string;
    type: string;
    value: string;
    ttl?: string;
    priority?: number;
    status?: string;
}

export interface MailDomain {
    id: string;
    client_id: string;
    domain: string;
    resend_domain_id: string | null;
    status: 'pending' | 'verified' | 'failed';
    dns_records: MailDomainDnsRecord[] | null;
    created_at: string;
}

export interface MailTemplate {
    id: string;
    client_id: string;
    name: string;
    layout: 'simple' | 'image_header' | 'newsletter';
    subject_template: string;
    body_html: string;
    created_at: string;
    updated_at: string;
}

export interface MailCampaignFilters {
    statuses?: string[];
    services?: string[];
    created_after?: string;
    created_before?: string;
}

export interface MailCampaign {
    id: string;
    client_id: string;
    template_id: string | null;
    name: string;
    subject: string;
    status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'failed';
    filters: MailCampaignFilters;
    scheduled_at?: string | null;
    sent_at?: string | null;
    created_at: string;
}

export interface MailCampaignRecipient {
    id: string;
    campaign_id: string;
    lead_id: string | null;
    email: string;
    status: 'pending' | 'sent' | 'failed' | 'bounced';
    sent_at?: string | null;
    error?: string | null;
    created_at: string;
}

export interface MailAutomation {
    id: string;
    client_id: string;
    name: string;
    trigger_type: 'lead_created' | 'lead_status_changed';
    trigger_status?: string | null;
    delay_hours: number;
    template_id: string | null;
    active: boolean;
    created_at: string;
}

// ─── Vista admin: panoramica Mail Marketing per cliente ────────────────────────

export interface MailMarketingOverviewClient {
    id: string;
    name: string;
    mail_marketing_enabled: boolean;
    mail_domains: { domain: string; status: MailDomain['status'] }[];
    mail_campaigns: {
        id: string;
        name: string;
        status: MailCampaign['status'];
        sent_at: string | null;
        mail_campaign_recipients: { status: MailCampaignRecipient['status'] }[];
    }[];
}

export interface MwsMonthlyRevenue {
    id: string;
    client_id: string;
    month: string; // YYYY-MM-01
    revenue_amount: number;
    paid_amount: number;
    status: 'paid' | 'unpaid' | 'partially_paid';
    created_at: string;
    updated_at: string;
}

// FIX: Added SavedForm and SavedFormConfig types to resolve error in SavedFormsModule.
export interface SavedFormConfig {
    externalWebhookUrl: string;
    thankYouUrl: string;
    isMultiStep: boolean;
    fieldSteps: Record<string, number>;
    fieldLayouts: Record<string, { desktop: number; mobile: number }>;
    showFormTitle: boolean;
    formTitle: string;
    enablePrivacyPolicy: boolean;
    privacyPolicyUrl: string;
    privacyPolicyCheckedByDefault: boolean;
    enableTerms: boolean;
    termsUrl: string;
    termsCheckedByDefault: boolean;
    primaryColor: string;
    buttonTextColor: string;
    formBackgroundColor: string;
    textColor: string;
    labelColor: string;
    submitButtonText: string;
}

export interface SavedForm {
    id: string;
    name: string;
    client_id: string;
    service_name: string;
    config: SavedFormConfig;
    created_at: string;
}

export interface CalendarAppointment extends Appointment {
    leads: Lead | null;
    clients: Pick<Client, 'name' | 'user_id'> | null;
}