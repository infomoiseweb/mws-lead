// Incrementa la parte numerica finale di un numero di preventivo alfanumerico,
// mantenendo prefisso testuale e zero-padding (es. "C5" -> "C6", "C099" -> "C100").
export function incrementQuoteNumber(value: string): string {
    const match = value.match(/^(.*?)(\d+)$/);
    if (!match) return value;

    const [, prefix, digits] = match;
    const incremented = (parseInt(digits, 10) + 1).toString();
    const padded = incremented.length < digits.length
        ? incremented.padStart(digits.length, '0')
        : incremented;

    return `${prefix}${padded}`;
}
