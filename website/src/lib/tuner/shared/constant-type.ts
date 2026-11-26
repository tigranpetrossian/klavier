export type ConstantType =
  | { kind: 'number' }
  | { kind: 'string' }
  | { kind: 'boolean' }
  | { kind: 'null' }
  | { kind: 'color' }
  | { kind: 'literal'; value: string | number | boolean }
  | { kind: 'array'; element: ConstantType }
  | { kind: 'tuple'; elements: readonly ConstantType[] }
  | { kind: 'object'; fields: Readonly<Record<string, ConstantType>> }
  | { kind: 'union'; members: readonly ConstantType[] };

export type ColorModel = 'hex' | 'rgb' | 'hsl' | 'oklch';

export type TypeInfo = { type: ConstantType } | { inferred: true } | { unreadable: string } | { unsupported: string };
