import type { ColorModel, ConstantType } from '../shared/constant-type';
import { deepEqual, isPlainObject } from './plain-data';

export type Inference = { ok: true; type: ConstantType } | { ok: false; reason: string };

const COLOR_PATTERNS: readonly (readonly [ColorModel, RegExp])[] = [
  ['hex', /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i],
  ['rgb', /^rgb\(.+\)$/],
  ['hsl', /^hsl\(.+\)$/],
  ['oklch', /^oklch\(.+\)$/],
];

export function fitsType(value: unknown, type: ConstantType): boolean {
  switch (type.kind) {
    case 'number':
      return typeof value === 'number' && Number.isFinite(value);
    case 'string':
      return typeof value === 'string';
    case 'boolean':
      return typeof value === 'boolean';
    case 'null':
      return value === null;
    case 'color':
      return typeof value === 'string' && colorModelOf(value) !== null;
    case 'literal':
      return value === type.value;
    case 'array':
      return Array.isArray(value) && value.every((item) => fitsType(item, type.element));
    case 'tuple':
      return (
        Array.isArray(value) &&
        value.length === type.elements.length &&
        type.elements.every((element, index) => fitsType(value[index], element))
      );
    case 'object':
      return isPlainObject(value) && fieldsFit(value, type.fields);
    case 'union':
      return type.members.some((member) => fitsType(value, member));
  }
}

export function inferType(value: unknown): Inference {
  if (value === null) return { ok: true, type: { kind: 'null' } };
  if (typeof value === 'string') return { ok: true, type: { kind: 'string' } };
  if (typeof value === 'boolean') return { ok: true, type: { kind: 'boolean' } };
  if (typeof value === 'number') return inferNumber(value);
  if (Array.isArray(value)) return inferArray(value);
  if (isPlainObject(value)) return inferObject(value);
  return { ok: false, reason: describeUnsupported(value) };
}

export function literalOptions(type: ConstantType): readonly (string | number)[] | null {
  if (type.kind !== 'union') return null;
  const options = type.members.flatMap((member) =>
    member.kind === 'literal' && typeof member.value !== 'boolean' ? [member.value] : []
  );
  return options.length === type.members.length ? options : null;
}

export function colorModelOf(value: string): ColorModel | null {
  const match = COLOR_PATTERNS.find(([, pattern]) => pattern.test(value));
  return match ? match[0] : null;
}

function fieldsFit(value: Record<string, unknown>, fields: Readonly<Record<string, ConstantType>>): boolean {
  const names = Object.keys(fields);
  return (
    Object.keys(value).length === names.length &&
    names.every((name) => Object.hasOwn(value, name) && fitsType(value[name], fields[name]))
  );
}

function inferNumber(value: number): Inference {
  return Number.isFinite(value) ? { ok: true, type: { kind: 'number' } } : { ok: false, reason: String(value) };
}

function inferArray(items: readonly unknown[]): Inference {
  if (items.length === 0) return { ok: false, reason: 'an empty array has no element type to infer' };
  const members: ConstantType[] = [];
  for (const item of items) {
    const inferred = inferType(item);
    if (!inferred.ok) return inferred;
    if (!members.some((member) => deepEqual(member, inferred.type))) members.push(inferred.type);
  }
  return { ok: true, type: { kind: 'array', element: members.length === 1 ? members[0] : { kind: 'union', members } } };
}

function inferObject(value: Record<string, unknown>): Inference {
  const fields: Record<string, ConstantType> = {};
  for (const [name, field] of Object.entries(value)) {
    const inferred = inferType(field);
    if (!inferred.ok) return inferred;
    fields[name] = inferred.type;
  }
  return { ok: true, type: { kind: 'object', fields } };
}

function describeUnsupported(value: unknown): string {
  if (value === undefined) return 'undefined';
  if (typeof value === 'function') return 'functions';
  if (typeof value === 'object') return 'class instances';
  return typeof value;
}
