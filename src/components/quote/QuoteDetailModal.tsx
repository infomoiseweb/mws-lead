import React, { useRef, useState } from 'react';
import Modal from '@components/ui/Modal';
import type { Client, QuoteItem, QuoteWithDetails } from '../types';
import { FileText, Calendar, User, Truck, Hash, Download, Send, Loader2, MessageCircle, Eye } from 'lucide-react';
import QuotePreviewDocument from './QuotePreviewDocument';
import { generateQuotePdfBlob, blobToBase64, downloadPdf } from '@lib/generateQuotePdf';
import { sendQuotePdfEmail } from '@api/email';
import { uploadQuotePdf } from '@api/storage';
import { findLeadEmail, findLeadPhone, normalizePhoneForWhatsApp } from '@lib/leadFields';

interface QuoteDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    quote: QuoteWithDetails | null;
    client: Client | null;
}

const formatCurrency = (value: number) => value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

const QuoteDetailModal: React.FC<QuoteDetailModalProps> = ({ isOpen, onClose, quote, client }) => {
    const previewRef = useRef<HTMLDivElement>(null);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
    const [isSendingEmail, setIsSendingEmail] = useState(false);
    const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

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
        : Object.entries(quote.items as Record<string, string>).map(([key, value]) => ({
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

    const handleSendEmail = async () => {
        if (!previewRef.current || !recipientEmail) return;
        setIsSendingEmail(true);
        setStatusMessage(null);
        try {
            const blob = await generateQuotePdfBlob(previewRef.current);
            const pdfBase64 = await blobToBase64(blob);
            await sendQuotePdfEmail({
                recipientEmail,
                recipientName: quote.recipient_name,
                quoteNumber: quote.quote_number_display || quote.id.substring(0, 6),
                totalAmount: quote.total_amount,
                pdfBase64,
                clientName: client?.name || '',
            });
            setStatusMessage({ type: 'success', message: 'Email inviata con successo.' });
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: err.message || 'Errore durante l\'invio dell\'email.' });
        } finally {
            setIsSendingEmail(false);
        }
    };

    const handleSendWhatsApp = async () => {
        if (!previewRef.current || !recipientPhone || !client) return;
        setIsSendingWhatsApp(true);
        setStatusMessage(null);
        try {
            const blob = await generateQuotePdfBlob(previewRef.current);
            const pdfUrl = await uploadQuotePdf(client.id, quote.id, blob);
            const message = `Ciao ${quote.recipient_name}, ecco il preventivo n. ${quote.quote_number_display || quote.id.substring(0, 6)} (€ ${formatCurrency(quote.total_amount)}): ${pdfUrl}`;
            const waUrl = `https://wa.me/${normalizePhoneForWhatsApp(recipientPhone)}?text=${encodeURIComponent(message)}`;
            window.open(waUrl, '_blank');
        } catch (err: any) {
            setStatusMessage({ type: 'error', message: err.message || 'Errore durante la preparazione del PDF.' });
        } finally {
            setIsSendingWhatsApp(false);
        }
    };

    const renderItems = () => {
        if (Array.isArray(quote.items)) {
            // New format: QuoteItem[]
            return (
                <table className="min-w-full">
                    <thead className="bg-slate-100 dark:bg-slate-700">
                        <tr>
                            <th className="p-2 text-left font-semibold">Descrizione</th>
                            <th className="p-2 text-center font-semibold w-20">Q.tà</th>
                            <th className="p-2 text-right font-semibold w-28">Prezzo</th>
                            <th className="p-2 text-center font-semibold w-20">IVA %</th>
                            <th className="p-2 text-right font-semibold w-32">Totale Riga</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                        {(quote.items as QuoteItem[]).map((item, index) => {
                            const lineTotal = item.quantity * item.price;
                            return (
                                <tr key={item.id || index}>
                                    <td className="p-2 font-medium">{item.description}</td>
                                    <td className="p-2 text-center">{item.quantity}</td>
                                    <td className="p-2 text-right">{formatCurrency(item.price)}</td>
                                    <td className="p-2 text-center">{item.vat}%</td>
                                    <td className="p-2 text-right font-semibold">{formatCurrency(lineTotal)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            );
        }

        // Old format: Record<string, string>
        return (
            <table className="min-w-full">
                <thead className="bg-slate-100 dark:bg-slate-700">
                    <tr>
                        <th className="p-2 text-left font-semibold">Descrizione</th>
                        <th className="p-2 text-left font-semibold">Valore</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {Object.entries(quote.items).map(([key, value], index) => (
                        <tr key={index}>
                            <td className="p-2 font-medium">{key}</td>
                            <td className="p-2">{value}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        );
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`Dettagli Preventivo #${quote.quote_number_display || quote.id.substring(0,6)}`} size="large">
            <div className="space-y-6 text-sm">
                {/* Header Info */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                    <div className="flex items-center">
                        <Hash size={16} className="mr-2 text-slate-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Numero</p>
                            <p className="font-semibold">{quote.quote_number_display}</p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <Calendar size={16} className="mr-2 text-slate-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Data</p>
                            <p className="font-semibold">{new Date(quote.quote_date + 'T00:00:00').toLocaleDateString('it-IT')}</p>
                        </div>
                    </div>
                    <div className="flex items-center">
                        <User size={16} className="mr-2 text-slate-500" />
                        <div>
                            <p className="text-xs text-slate-500 dark:text-gray-400">Destinatario</p>
                            <p className="font-semibold">{quote.recipient_name}</p>
                        </div>
                    </div>
                </div>

                {/* Vehicle Details */}
                {Object.keys(quote.vehicle_details).length > 0 && (
                     <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700">
                        <h3 className="text-md font-semibold mb-2 flex items-center"><Truck size={16} className="mr-2" /> Dettagli Veicolo</h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-2">
                             {quote.vehicle_details['Servizio'] && (
                                <div key="servizio" className="col-span-2 md:col-span-4">
                                    <span className="text-slate-500 dark:text-gray-400">Servizio:</span> <span className="font-semibold">{quote.vehicle_details['Servizio']}</span>
                                </div>
                            )}
                            {Object.entries(quote.vehicle_details).map(([key, value]) => (
                                (key !== 'Servizio' && value) && <div key={key}><span className="text-slate-500 dark:text-gray-400">{key}:</span> <span className="font-semibold">{value}</span></div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Line Items */}
                <div>
                    <h3 className="text-md font-semibold mb-2">Voci del Preventivo</h3>
                    <div className="overflow-x-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                        {renderItems()}
                    </div>
                </div>

                {/* Notes & Totals */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                    {quote.notes && (
                        <div>
                            <h3 className="text-md font-semibold mb-2">Note</h3>
                            <p className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-pre-wrap">{quote.notes}</p>
                        </div>
                    )}
                    <div className="p-4 bg-slate-100 dark:bg-slate-900/50 rounded-lg space-y-2 text-sm md:col-start-2">
                        <div className="flex justify-between"><span>Imponibile</span> <span className="font-semibold">{formatCurrency(quote.taxable_amount)}</span></div>
                        <div className="flex justify-between"><span>IVA</span> <span className="font-semibold">{formatCurrency(quote.vat_amount)}</span></div>
                        <div className="flex justify-between font-bold text-lg pt-2 border-t border-slate-300 dark:border-slate-600"><span>TOTALE</span> <span>{formatCurrency(quote.total_amount)}</span></div>
                    </div>
                </div>

                {/* Termini e Condizioni */}
                {quote.terms_and_conditions && (
                    <div>
                        <h3 className="text-md font-semibold mb-2 flex items-center"><FileText size={16} className="mr-2" /> Termini e Condizioni</h3>
                        <p className="p-3 bg-slate-50 dark:bg-slate-900/50 rounded-lg border border-slate-200 dark:border-slate-700 whitespace-pre-wrap text-xs text-slate-600 dark:text-gray-300">{quote.terms_and_conditions}</p>
                    </div>
                )}

                {/* Anteprima documento */}
                <div>
                    <h3 className="text-md font-semibold mb-2 flex items-center"><Eye size={16} className="mr-2" /> Anteprima Documento</h3>
                    <div className="overflow-auto border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-100 dark:bg-slate-900/50" style={{ maxHeight: '400px' }}>
                        <div style={{ width: '794px', transform: 'scale(0.45)', transformOrigin: 'top left' }}>
                            <QuotePreviewDocument
                                ref={previewRef}
                                clientName={client?.name || ''}
                                branding={client?.quote_settings?.branding}
                                data={{
                                    quoteNumber: quote.quote_number_display || quote.id.substring(0, 6),
                                    quoteDate: quote.quote_date,
                                    dueDate: quote.due_date,
                                    recipientName: quote.recipient_name,
                                    vehicleDetails: quote.vehicle_details,
                                    items: previewItems,
                                    notes: quote.notes,
                                    termsAndConditions: quote.terms_and_conditions,
                                    taxableAmount: quote.taxable_amount,
                                    vatAmount: quote.vat_amount,
                                    totalAmount: quote.total_amount,
                                }}
                            />
                        </div>
                    </div>
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

                <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-700 flex flex-wrap justify-end gap-3">
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
            </div>
        </Modal>
    );
};

export default QuoteDetailModal;
