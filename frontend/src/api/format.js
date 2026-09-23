const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// same formatting the slack message uses, so the table and the report agree
export function formatCurrency(cents) {
  if (cents === null || cents === undefined) return '-';
  return currency.format(cents / 100);
}

export function formatRoas(roas) {
  return roas === null || roas === undefined ? 'n/a' : `${roas.toFixed(2)}x`;
}

export function formatDate(value) {
  return value ? new Date(value).toISOString().slice(0, 10) : '-';
}

export function formatTime(value) {
  return value ? new Date(value).toLocaleTimeString() : '-';
}
