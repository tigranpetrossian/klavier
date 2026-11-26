const DIMENSION = /^\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)([a-z%]*)\s*$/i;
const FORMAT_DECIMALS = 6;

export function parseCssNumber(text: string, unit = ''): number | null {
  const match = DIMENSION.exec(text);
  if (!match) return null;
  const value = Number(match[1]);
  if (match[2].toLowerCase() === unit.toLowerCase()) return value;
  return match[2] === '' && value === 0 ? 0 : null;
}

export function formatCssNumber(value: number, unit = ''): string {
  return `${Number(value.toFixed(FORMAT_DECIMALS))}${unit}`;
}
