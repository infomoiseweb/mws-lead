import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

// Rasterizza il nodo del documento preventivo e lo impagina su pagine A4.
export async function generateQuotePdfBlob(element: HTMLElement): Promise<Blob> {
    const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
    });

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    const pageHeightPx = (canvas.width / A4_WIDTH_MM) * A4_HEIGHT_MM;
    let renderedHeightPx = 0;
    let isFirstPage = true;

    while (renderedHeightPx < canvas.height) {
        const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedHeightPx);

        const pageCanvas = document.createElement('canvas');
        pageCanvas.width = canvas.width;
        pageCanvas.height = sliceHeightPx;
        const ctx = pageCanvas.getContext('2d')!;
        ctx.drawImage(canvas, 0, -renderedHeightPx);

        const pageImgData = pageCanvas.toDataURL('image/jpeg', 0.95);
        const sliceHeightMm = (sliceHeightPx * A4_WIDTH_MM) / canvas.width;

        if (!isFirstPage) pdf.addPage();
        pdf.addImage(pageImgData, 'JPEG', 0, 0, A4_WIDTH_MM, sliceHeightMm);

        renderedHeightPx += sliceHeightPx;
        isFirstPage = false;
    }

    return pdf.output('blob');
}

export function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            resolve(result.split(',')[1] || '');
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

export function downloadPdf(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
