import type { PropertyType } from './value-types';

export type PropertyForm = 'raw' | 'reference' | 'expression';

const REFERENCE = /^var\(\s*(--[^\s,()]+)\s*\)$/;
const VAR_CALL = /var\(\s*(--[^\s,()]+)/g;
const HAS_VAR_CALL = /var\(\s*--/;
const PROPERTY_NAME = /^--[^\s,()]+$/;
const ACCEPTED_TARGET_TYPES: Readonly<Record<PropertyType, readonly PropertyType[]>> = {
  color: ['color'],
  length: ['length'],
  percentage: ['percentage'],
  'length-percentage': ['length-percentage', 'length', 'percentage'],
  number: ['number', 'integer'],
  integer: ['integer'],
  angle: ['angle'],
  time: ['time'],
  text: ['text', 'color', 'length', 'percentage', 'length-percentage', 'number', 'integer', 'angle', 'time'],
};

export function formOf(value: string): PropertyForm {
  if (REFERENCE.test(value.trim())) return 'reference';
  return HAS_VAR_CALL.test(value) ? 'expression' : 'raw';
}

export function referenceTarget(value: string): string | null {
  return REFERENCE.exec(value.trim())?.[1] ?? null;
}

export function referenceTo(name: string): string | null {
  return PROPERTY_NAME.test(name) ? `var(${name})` : null;
}

export function fitsTarget(type: PropertyType, targetTypes: readonly PropertyType[]): boolean {
  return targetTypes.some((targetType) => ACCEPTED_TARGET_TYPES[type].includes(targetType));
}

export function refersTo(name: string, goal: string, valuesOf: (name: string) => readonly string[]): boolean {
  const visited = new Set<string>();
  const visit = (current: string): boolean => {
    if (current === goal) return true;
    if (visited.has(current)) return false;
    visited.add(current);
    return valuesOf(current).some((value) => referencedNames(value).some(visit));
  };
  return visit(name);
}

function referencedNames(value: string): readonly string[] {
  return [...value.matchAll(VAR_CALL)].map((match) => match[1]);
}
