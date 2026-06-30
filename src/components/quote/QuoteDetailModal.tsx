import React, { useEffect, useRef, useState } from 'react';
import Modal from '@components/ui/Modal';
import type { Client, QuoteItem, QuoteWithDetails } from '../types';
import { Download, Send, Loader2, MessageCircle, Eye, Maximize2 } from 'lucide-react';
import QuotePreviewDocument from './QuotePreviewDocument';
import { generateQuotePdfBlob, downloadPdf } from '@lib/generateQuotePdf';
import { uploadQuotePdf, getQuoteShareUrl } from '@api/storage';
import { updateQuoteStatus } from '@api/quotes';
import { findLeadEmail, findLeadPhone, normalizePhoneForWhatsApp } from '@lib/leadFields';
import { applyQuoteShareTemplate, DEFAULT_EMAIL_SUBJECT_TEMPLATE, DEFAULT_EMAIL_BODY_TEMPLATE, DEFAULT_WHATSAPP_MESSAGE_TEMPLATE } from '@lib/quoteShareTemplates';

interface QuoteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    quote: QuoteWithDetails | null;
    client: Client | null;
    onSent?: () => void;
}

const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({ isOpen, onClose, quote, client, onSent }) => {
    const previewRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
    const [isFullPreviewOpen, setIsFullPreviewOpen] = useState(false);

    const previewContainerRef = useRef<HTMLDivElement>(null);
    const previewContentRef = useRef<HTMLDivElement>(null);
    const [previewScale, setPreviewScale] = useState(1);
    const [previewHeight, setPreviewHeight] = useState(0);

    useEffect(() => {
        const updatePreviewSize = () => {
            const containerWidth = previewContainerRef.current?.offsetWidth || 0;
            const contentHeight = previewContentRef.current?.offsetHeight || 0;
            if (containerWidth > 0 && contentHeight > 0) {
                const scale = containerWidth / 794;
                setPreviewScale(scale);
                setPreviewHeight(contentHeight * scale);
            }
        };
        updatePreviewSize();
        const resizeObserver = new ResizeObserver(updatePreviewSize);
        if (previewContainerRef.current) resizeObserver.observe(previewContainerRef.current);
        if (previewContentRef.current) resizeObserver.observe(previewContentRef.current);
        return () => resizeObserver.disconnect();
    }, [isOpen, quote]);

    if (!isOpen || !quote) return null;

    const recipientEmail = findLeadEmail(quote.leads?.data);
    const recipientPhone = findLeadPhone(quote.leads?.data);

    const previewItems = Array.isArray(quote.items)
        ? (quote.items as QuoteItem[]).map(item => ({
            description: item.description,
            quantity: item.quantity,
            price: item.price,
            vat: item.vat,
        }))
        : Object.entries((quote.items || {}) as Record<string, string>).map(([key, value]) => ({
            description: `${key}: ${value}`,
            quantity: 1,
            price: 0,
            vat: 0,
        }));

    const handleDownloadPdf = async () => {
        if (!previewRef.current) return;
        setIsGeneratingPdf(true);
        try {
            const blob = await generateQuotePdfBlob(previewRef.current);
            downloadPdf(blob, `Preventivo_${quote.quote_number_display || quote.id.substring(0, 6)}.pdf`);
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    const includePdfLink = client?.quote_settings?.share_message?.include_pdf_link !== false;

    const markAsSent = async () => {
        if (quote.status !== 'draft') return;
        try {
            await updateQuoteStatus(quote.id, 'sent');
            onSent?.();
        } catch (err) {
            console.error('Errore aggiornamento stato preventivo a "Inviato":', err);
        }
    };

    const handleSendEmail = async () => {
        if (!previewRef.current || !recipientEmail || !client) return;
        setIsSendingEmail(true);
        setStatusMessage(null);
        // Apri subito la scheda (entro il gesto utente sincrono), altrimenti alcuni browser
        // (es. Edge su Windows) bloccano o disturbano il popup dopo le await successive.
        const newTab = window.open('', '_blank');
        try {
            const quoteNumber = quote.quote_number_display || quote.id.substring(0, 6);
            let linkPdf = '';
            if (includePdfLink) {
                const blob = await generateQuotePdfBlob(previewRef.current);
                await uploadQuotePdf(client.id, quote.id, blob);
                const pdfUrl = await getQuoteShareUrl(quote.id, client.id);
                linkPdf = `Puoi scaricarlo da qui: ${pdfUrl}`;
            }
            const vars = { nome: quote.recipient_name, numero: quoteNumber, azienda: client.quote_settings?.branding?.brand_name || client.name, link_pdf: linkPdf };
            const shareSettings = client.quote_settings?.share_message;
            const subject = applyQuoteShareTemplate(shareSettings?.email_subject_template || DEFAULT_EMAIL_SUBJECT_TEMPLATE, vars);
            const body = applyQuoteShareTemplate(shareSettings?.email_body_template || DEFAULT_EMAIL_BODY_TEMPLATE, vars);
            const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(recipientEmail)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
            if (newTab) {
                newTab.location.href = gmailUrl;
            } else {
                setStatusMessage({ type: 'error', message: 'Il browser ha bloccato l\'apertura di Gmail. Consenti i popup per questo sito e riprova.' });
                return;
            }
            await markAsSent();
        } catch (err: any) {
            newTab?.close();
            setStatusMessage({ type: 'error', message: err.message || 'Errore durante la preparazione del PDF.' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!previewRef.current || !recipientPhone || !client) return;
        setIsSendingWhatsApp(true);
        setStatusMessage(null);
        const newTab = window.open('', '_blank');
        try {
            const quoteNumber = quote.quote_number_display || quote.id.substring(0, 6);
            let linkPdf = '';
            if (includePdfLink) {
                const blob = await generateQuotePdfBlob(previewRef.current);
                await uploadQuotePdf(client.id, quote.id, blob);
                const pdfUrl = await getQuoteShareUrl(quote.id, client.id);
                linkPdf = `Puoi scaricarlo da qui: ${pdfUrl}`;
            }
            const vars = { nome: quote.recipient_name, numero: quoteNumber, azienda: client.quote_settings?.branding?.brand_name || client.name, link_pdf: linkPdf };
            const shareSettings = client.quote_settings?.share_message;
            const message = applyQuoteShareTemplate(shareSettings?.whatsapp_message_template || DEFAULT_WHATSAPP_MESSAGE_TEMPLATE, vars);
            const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(recipientPhone)}?text=${encodeURIComponent(message)}`;
            if (newTab) {
                newTab.location.href = waUrl;
            } else {
                setStatusMessage({ type: 'error', message: 'Il browser ha bloccato l\'apertura di WhatsApp. Consenti i popup per questo sito e riprova.' });
                return;
            }
            await markAsSent();
        } catch (err: any) {
            newTab?.close();
            setStatusMessage({ type: 'error', message: err.message || 'Errore durante la preparazione del PDF.' });
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const previewData = {
        quoteNumber: quote.quote_number_display || quote.id.substring(0, 6),
        quoteDate: quote.quote_date,
        dueDate: quote.due_date,
        recipientName: quote.recipient_name,
        vehicleDetails: quote.vehicle_details,
        items: previewItems,
        notes: quote.notes,
        termsAndConditions: quote.terms_and_conditions,
        extraFields: quote.extra_fields,
        taxableAmount: quote.taxable_amount,
        vatAmount: quote.vat_amount,
        totalAmount: quote.total_amount,
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={`Dettagli Preventivo #${quote.quote_number_display || quote.id.substring(0,6)}`}
            size="large"
            footer={
                <div className="flex flex-wrap justify-end gap-3">
                    <button onClick={onClose} className="bg-slate-500 text-white px-4 py-2 rounded-lg shadow hover:bg-slate-600">Chiudi</button>
                    <button
                        onClick={handleDownloadPdf}
                        disabled={isGeneratingPdf}
                        className="flex items-center gap-2 bg-slate-200 dark:bg-slate-600 text-slate-800 dark:text-white px-4 py-2 rounded-lg shadow hover:bg-slate-300 dark:hover:bg-slate-500 disabled:opacity-50"
                    >
                        {isGeneratingPdf ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Scarica PDF
                    </button>
                    {recipientPhone && (
                        <button
                            onClick={handleSendWhatsApp}
                            disabled={isSendingWhatsApp}
                            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg shadow hover:bg-green-700 disabled:opacity-50"
                        >
                            {isSendingWhatsApp ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />} Invia via WhatsApp
                        </button>
                    )}
                    {recipientEmail && (
                        <button
                            onClick={handleSendEmail}
                            disabled={isSendingEmail}
                            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg shadow hover:bg-primary-700 disabled:opacity-50"
                        >
                            {isSendingEmail ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Invia via Email
                        </button>
                    )}
                </div>
            }
        >
            <div className="space-y-6 text-sm">
                {/* Anteprima documento */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-md font-semibold flex items-center"><Eye size={16} className="mr-2" /> Anteprima Documento</h3>
                        <button
                            type="button"
                            onClick={() => setIsFullPreviewOpen(true)}
                            className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-500"
                        >
                            <Maximize2 size={14} /> Ingrandisci
                        </button>
                    </div>
                    <div ref={previewContainerRef} className="overflow-hidden border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-900/50" style={{ height: previewHeight || undefined }}>
                        <div ref={previewContentRef} style={{ width: '794px', transform: `scale(${previewScale})`, transformOrigin: 'top left' }}>
                            <QuotePreviewDocument
                                clientName={client?.name || ''}
                                branding={client?.quote_settings?.branding}
                                data={previewData}
                            />
                        </div>
                    </div>
                </div>

                {/* Copia nascosta a dimensione reale, usata per generare il PDF */}
                <div style={{ position: 'fixed', top: 0, left: '-9999px', zIndex: -1 }} aria-hidden="true">
                    <QuotePreviewDocument
                        ref={previewRef}
                        clientName={client?.name || ''}
                        branding={client?.quote_settings?.branding}
                        data={previewData}
                    />
                </div>

                {!recipientEmail && !recipientPhone && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                        Nessuna email o numero di telefono trovato in questa lead: per inviare il preventivo, scarica il PDF e invialo manualmente.
                    </p>
                )}

                {statusMessage && (
                    <p className={`text-sm text-center ${statusMessage.type === 'success' ? 'text-green-600' : 'text-red-500'}`}>
                        {statusMessage.message}
                    </p>
                )}
            </div>

            {isFullPreviewOpen && (
                <Modal isOpen={isFullPreviewOpen} onClose={() => setIsFullPreviewOpen(false)} title="Anteprima Preventivo" size="extra-large">
                    <div className="overflow-auto" style={{ maxHeight: '80vh' }}>
                        <QuotePreviewDocument
                            clientName={client?.name || ''}
                            branding={client?.quote_settings?.branding}
                            data={previewData}
                        />
                    </div>
                </Modal>
            )}
        </Modal>
    );
};

export default QuoteDetailModal;
