export function toNumber(value: number | '' | undefined): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

export function formatCurrency(value: number, currency = 'SEK'): string {
  return new Intl.NumberFormat('sv-SE', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(value: string): string {
  if (!value) {
    return '-';
  }

  return new Intl.DateTimeFormat('sv-SE').format(new Date(value));
}

export function roundCurrency(value: number): number {
  return Math.round(value * 100) / 100;
}
