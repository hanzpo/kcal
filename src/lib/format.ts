export const KG_PER_LB = 0.45359237;

export function kgToDisplay(kg: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? kg : kg / KG_PER_LB;
}

export function displayToKg(value: number, unit: 'kg' | 'lb'): number {
  return unit === 'kg' ? value : value * KG_PER_LB;
}

export function formatWeight(kg: number, unit: 'kg' | 'lb', decimals = 1): string {
  return `${kgToDisplay(kg, unit).toFixed(decimals)} ${unit}`;
}

export function formatKcal(kcal: number): string {
  return `${Math.round(kcal).toLocaleString()}`;
}

export function formatGrams(g: number): string {
  return g >= 10 ? `${Math.round(g)}` : `${Math.round(g * 10) / 10}`;
}

/** "1,234" style int, no unit. */
export function formatInt(n: number): string {
  return Math.round(n).toLocaleString();
}

export function formatSigned(n: number, decimals = 1): string {
  const v = n.toFixed(decimals);
  return n > 0 ? `+${v}` : v;
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}
