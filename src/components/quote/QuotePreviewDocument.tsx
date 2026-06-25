import React from 'react';
import type { QuoteBranding } from '../../types';

export interface QuotePreviewItem {
    description: string;
    quantity: number;
    price: number;
    vat: number;
}

export interface QuotePreviewData {
    quoteNumber: string;
    quoteDate: string;
    dueDate?: string;
    recipientName: string;
    vehicleDetails?: Record<string, string>;
    items: QuotePreviewItem[];
    notes?: string;
    termsAndConditions?: string;
    extraFields?: Record<string, string>;
    taxableAmount: number;
    vatAmount: number;
    totalAmount: number;
    customBlocks?: {
        title?: string;
        text: string;
        position: 'before_totals' | 'after_totals' | 'after_terms';
        bg_color: string;
        text_color: string;
        border_color: string;
    }[];
}

interface QuotePreviewDocumentProps {
    clientName: string;
    branding?: QuoteBranding;
    data: QuotePreviewData;
}

const FONT_FAMILIES: Record<NonNullable<QuoteBranding['font']>, string> = {
    sans: "'Inter', Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    mono: "'Courier New', monospace",
};

const formatCurrency = (value: number) => value.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const formatDate = (value?: string) => value ? new Date(value + 'T00:00:00').toLocaleDateString('it-IT') : '';

const CustomBlockRenderer = ({ block }: { block: NonNullable<QuotePreviewData['customBlocks']>[number] }) => (
    <div style={{ marginBottom: '20px', padding: '12px 16px', background: block.bg_color, color: block.text_color, border: `1px solid ${block.border_color}`, borderRadius: '4px' }}>
        {block.title && <p style={{ margin: '0 0 6px', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: block.text_color, opacity: 0.7 }}>{block.title}</p>}
        <p style={{ margin: 0, fontSize: '11px', whiteSpace: 'pre-line', lineHeight: 1.6 }}>{block.text}</p>
    </div>
);

const QuotePreviewDocument = React.forwardRef<HTMLDivElement, QuotePreviewDocumentProps>(({ clientName, branding, data }, ref) => {
    const primaryColor = branding?.primary_color || '#2563eb';
    const headerTextColor = branding?.header_text_color || '#ffffff';
    const fontFamily = FONT_FAMILIES[branding?.font || 'sans'];
    const blocksAt = (pos: string) => (data.customBlocks || []).filter(b => b.position === pos);

    // Colore base del testo e varianti derivate per label/note/date
    const textColor = branding?.text_color || '#1e293b';
    // Produce un colore attenuato mescolando textColor con bianco al 55% — evita dipendenze esterne
    const mutedColor = branding?.text_color
        ? `color-mix(in srgb, ${textColor} 55%, #ffffff)`
        : '#64748b';
    const subtleColor = branding?.text_color
        ? `color-mix(in srgb, ${textColor} 35%, #ffffff)`
        : '#94a3b8';

    return (
        <div
            ref={ref}
            style={{ fontFamily, color: textColor, background: '#ffffff', width: '794px', padding: '40px', boxSizing: 'border-box' }}
        >
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: `3px solid ${primaryColor}`, paddingBottom: '20px', marginBottom: '24px' }}>
                <div style={{ maxWidth: '60%' }}>
                    {branding?.logo_url ? (
                        <img src={branding.logo_url} alt={clientName} style={{ maxHeight: '70px', maxWidth: '260px', objectFit: 'contain', marginBottom: '8px' }} crossOrigin="anonymous" />
                    ) : (
                        <h1 style={{ margin: 0, fontSize: '22px', color: primaryColor }}>{branding?.brand_name || clientName}</h1>
                    )}
                    {branding?.company_details && (
                        <p style={{ margin: '6px 0 0', fontSize: '11px', color: mutedColor, whiteSpace: 'pre-line', lineHeight: 1.5 }}>{branding.company_details}</p>
                    )}
                </div>
                <div style={{ textAlign: 'right' }}>
                    <h2 style={{ margin: 0, fontSize: '20px', color: primaryColor, letterSpacing: '1px' }}>PREVENTIVO</h2>
                    <p style={{ margin: '6px 0 0', fontSize: '13px', fontWeight: 'bold' }}>N. {data.quoteNumber || '—'}</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', color: mutedColor }}>Data: {formatDate(data.quoteDate)}</p>
                    {data.dueDate && <p style={{ margin: '2px 0 0', fontSize: '11px', color: mutedColor }}>Scadenza: {formatDate(data.dueDate)}</p>}
                </div>
            </div>

            {/* Destinatario */}
            <div style={{ marginBottom: '20px' }}>
                <p style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: subtleColor }}>Destinatario</p>
                <p style={{ margin: '4px 0 0', fontSize: '14px', fontWeight: 'bold' }}>{data.recipientName || '—'}</p>
                {data.extraFields && Object.entries(data.extraFields).filter(([, v]) => v).map(([key, value]) => (
                    <p key={key} style={{ margin: '2px 0 0', fontSize: '11px', color: mutedColor }}>
                        <span style={{ color: subtleColor }}>{key}: </span>{value}
                    </p>
                ))}
            </div>

            {/* Vehicle / extra details */}
            {data.vehicleDetails && Object.values(data.vehicleDetails).some(Boolean) && (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', marginBottom: '20px', fontSize: '11px' }}>
                    {Object.entries(data.vehicleDetails).filter(([, v]) => v).map(([key, value]) => (
                        <div key={key}>
                            <span style={{ color: subtleColor }}>{key}: </span>
                            <span style={{ fontWeight: 'bold' }}>{value}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Custom blocks — before_totals */}
            {blocksAt('before_totals').map((b, i) => <CustomBlockRenderer key={i} block={b} />)}

            {/* Items table */}
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', marginBottom: '20px' }}>
                <thead>
                    <tr style={{ background: primaryColor, color: headerTextColor }}>
                        <th style={{ padding: '8px 10px', textAlign: 'left' }}>Descrizione</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>Q.tà</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '90px' }}>Prezzo</th>
                        <th style={{ padding: '8px 10px', textAlign: 'center', width: '60px' }}>IVA %</th>
                        <th style={{ padding: '8px 10px', textAlign: 'right', width: '100px' }}>Totale</th>
                    </tr>
                </thead>
                <tbody>
                    {data.items.map((item, index) => (
                        <tr key={index} style={{ borderBottom: '1px solid #e2e8f0' }}>
                            <td style={{ padding: '8px 10px' }}>{item.description}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.quantity}</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right' }}>{formatCurrency(item.price)} €</td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>{item.vat}%</td>
                            <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 'bold' }}>{formatCurrency(item.quantity * item.price)} €</td>
                        </tr>
                    ))}
                </tbody>
            </table>

            {/* Totals */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '24px' }}>
                <div style={{ width: '260px', fontSize: '12px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span>Imponibile</span>
                        <span>{formatCurrency(data.taxableAmount)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                        <span>IVA</span>
                        <span>{formatCurrency(data.vatAmount)} €</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '4px', borderTop: `2px solid ${primaryColor}`, fontSize: '15px', fontWeight: 'bold' }}>
                        <span>TOTALE</span>
                        <span>{formatCurrency(data.totalAmount)} €</span>
                    </div>
                </div>
            </div>

            {/* Custom blocks — after_totals */}
            {blocksAt('after_totals').map((b, i) => <CustomBlockRenderer key={i} block={b} />)}

            {/* Notes */}
            {data.notes && (
                <div style={{ marginBottom: '20px' }}>
                    <p style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: subtleColor }}>Note</p>
                    <p style={{ margin: '4px 0 0', fontSize: '11px', whiteSpace: 'pre-line', lineHeight: 1.5 }}>{data.notes}</p>
                </div>
            )}

            {/* Terms and conditions */}
            {data.termsAndConditions && (
                <div style={{ marginTop: '24px', paddingTop: '12px', borderTop: '1px solid #e2e8f0' }}>
                    <p style={{ margin: 0, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '1px', color: subtleColor }}>Termini e Condizioni</p>
                    <p style={{ margin: '4px 0 0', fontSize: '10px', whiteSpace: 'pre-line', lineHeight: 1.6, color: mutedColor }}>{data.termsAndConditions}</p>
                </div>
            )}

            {/* Custom blocks — after_terms */}
            {blocksAt('after_terms').map((b, i) => <CustomBlockRenderer key={i} block={b} />)}
        </div>
    );
});

QuotePreviewDocument.displayName = 'QuotePreviewDocument';

export default QuotePreviewDocument;
