// Formats a numeric amount as a currency string, e.g. formatMoney(130, "PHP") → "₱130.00".
const SYMBOLS: Record<string, string> = { PHP: "₱", USD: "$", EUR: "€" };

export function formatMoney(amount: number, currency: string): string {
  const symbol = SYMBOLS[currency] ?? `${currency} `;
  return `${symbol}${amount.toFixed(2)}`;
}
