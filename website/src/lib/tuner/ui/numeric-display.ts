const NUMBER_PRECISION = 12;
const BIG_NUDGE_FACTOR = 10;

export type NumericDisplay = { precision: number; smallNudge: number; bigNudge: number };

export function numericDisplay(step: number, scale: number, precision?: number): NumericDisplay {
  const smallNudge = Number((step * scale).toPrecision(NUMBER_PRECISION));
  return { precision: precision ?? decimalsOf(smallNudge), smallNudge, bigNudge: smallNudge * BIG_NUDGE_FACTOR };
}

function decimalsOf(value: number): number {
  const text = String(value);
  const dot = text.indexOf('.');
  return dot === -1 ? 0 : text.length - dot - 1;
}
