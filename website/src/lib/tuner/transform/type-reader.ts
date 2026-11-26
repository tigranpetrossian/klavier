import * as t from '@babel/types';
import type { ConstantType, TypeInfo } from '../shared/constant-type.ts';
import type { TypeBinding, TypeBindings } from './type-bindings.ts';

type Failure = { ok: false; kind: 'unreadable' | 'unsupported'; reason: string };
type Reading = { ok: true; type: ConstantType } | Failure;
type FieldsReading = { ok: true; fields: Record<string, ConstantType> } | Failure;

type ReadScope = {
  readonly file: string;
  readonly bindings: TypeBindings;
  readonly seen: ReadonlySet<TypeBinding>;
};

const UNSUPPORTED_KEYWORDS: Partial<Record<t.TSType['type'], string>> = {
  TSUndefinedKeyword: 'undefined',
  TSVoidKeyword: 'undefined',
  TSBigIntKeyword: 'bigint',
  TSSymbolKeyword: 'symbols',
  TSFunctionType: 'functions',
  TSConstructorType: 'functions',
  TSAnyKeyword: 'any',
  TSUnknownKeyword: 'unknown',
  TSNeverKeyword: 'never',
};

const KEYWORD_TYPES: Partial<Record<t.TSType['type'], ConstantType>> = {
  TSNumberKeyword: { kind: 'number' },
  TSStringKeyword: { kind: 'string' },
  TSBooleanKeyword: { kind: 'boolean' },
  TSNullKeyword: { kind: 'null' },
};

const ARRAY_NAMES = new Set(['Array', 'ReadonlyArray']);

export function readTypeArgument(node: t.TSType | undefined, file: string, bindings: TypeBindings): TypeInfo {
  if (!node) return { inferred: true };
  const reading = readType(node, { file, bindings, seen: new Set() });
  if (reading.ok) return { type: reading.type };
  return reading.kind === 'unsupported' ? { unsupported: reading.reason } : { unreadable: reading.reason };
}

function readType(node: t.TSType, scope: ReadScope): Reading {
  const keyword = KEYWORD_TYPES[node.type];
  if (keyword) return { ok: true, type: keyword };
  const unsupportedKeyword = UNSUPPORTED_KEYWORDS[node.type];
  if (unsupportedKeyword) return unsupported(unsupportedKeyword);
  switch (node.type) {
    case 'TSLiteralType':
      return readLiteral(node.literal);
    case 'TSUnionType':
      return combine(
        node.types.map((member) => readType(member, scope)),
        (members) => ({ kind: 'union', members: members.flatMap(unionMembers) })
      );
    case 'TSArrayType':
      return map(readType(node.elementType, scope), (element) => ({ kind: 'array', element }));
    case 'TSTupleType':
      return combine(
        node.elementTypes.map((element) => readTupleElement(element, scope)),
        (elements) => ({ kind: 'tuple', elements })
      );
    case 'TSTypeLiteral':
      return object(readFields(node.members, scope));
    case 'TSTypeOperator':
      return node.operator === 'readonly'
        ? readType(node.typeAnnotation, scope)
        : unreadable(`'${node.operator}' types`);
    case 'TSParenthesizedType':
      return readType(node.typeAnnotation, scope);
    case 'TSTypeReference':
      return readReference(node, scope);
    default:
      return unreadable(`${node.type.replace(/^TS/, '')} types`);
  }
}

function readLiteral(literal: t.TSLiteralType['literal']): Reading {
  if (t.isStringLiteral(literal) || t.isNumericLiteral(literal) || t.isBooleanLiteral(literal)) {
    return { ok: true, type: { kind: 'literal', value: literal.value } };
  }
  if (t.isUnaryExpression(literal) && literal.operator === '-' && t.isNumericLiteral(literal.argument)) {
    return { ok: true, type: { kind: 'literal', value: -literal.argument.value } };
  }
  if (t.isBigIntLiteral(literal)) return unsupported('bigint');
  return unreadable('template literal types');
}

function readTupleElement(element: t.TSType | t.TSNamedTupleMember, scope: ReadScope): Reading {
  if (t.isTSNamedTupleMember(element)) {
    return element.optional ? unsupported('optional tuple elements') : readType(element.elementType, scope);
  }
  if (t.isTSOptionalType(element)) return unsupported('optional tuple elements');
  if (t.isTSRestType(element)) return unsupported('rest tuple elements');
  return readType(element, scope);
}

function readFields(members: readonly t.TSTypeElement[], scope: ReadScope): FieldsReading {
  const fields: Record<string, ConstantType> = {};
  for (const member of members) {
    if (t.isTSMethodSignature(member)) return unsupported('functions');
    if (!t.isTSPropertySignature(member)) return unreadable(`${member.type.replace(/^TS/, '')} members`);
    const name = propertyName(member);
    if (name === null || !member.typeAnnotation) return unreadable('computed or untyped fields');
    if (member.optional) return unsupported('optional fields');
    const field = readType(member.typeAnnotation.typeAnnotation, scope);
    if (!field.ok) return field;
    fields[name] = field.type;
  }
  return { ok: true, fields };
}

function readReference(node: t.TSTypeReference, scope: ReadScope): Reading {
  const name = entityPath(node.typeName);
  if (name === null) return unreadable("'this' types");
  const label = name.join('.');
  const typeArguments = node.typeArguments?.params ?? [];
  const binding = scope.bindings.lookup(scope.file, name);
  if (!binding && ARRAY_NAMES.has(label) && typeArguments.length === 1) {
    return map(readType(typeArguments[0], scope), (element) => ({ kind: 'array', element }));
  }
  if (typeArguments.length > 0) return unreadable(`generic type '${label}'`);
  return binding ? readBinding(binding, label, scope) : unreadable(`type '${label}'`);
}

function readBinding(binding: TypeBinding, label: string, scope: ReadScope): Reading {
  switch (binding.kind) {
    case 'color':
      return { ok: true, type: { kind: 'color' } };
    case 'class':
      return unsupported('class instances');
    case 'generic':
      return unreadable(`generic type '${label}'`);
    case 'namespace':
      return unreadable(`namespace '${label}'`);
    case 'alias':
    case 'interface': {
      if (scope.seen.has(binding)) return unreadable(`recursive type '${label}'`);
      const inner = { ...scope, file: binding.file, seen: new Set([...scope.seen, binding]) };
      return binding.kind === 'alias'
        ? readType(binding.type, inner)
        : object(readInterface(binding.declarations, inner));
    }
  }
}

function readInterface(declarations: readonly t.TSInterfaceDeclaration[], scope: ReadScope): FieldsReading {
  const fields: Record<string, ConstantType> = {};
  for (const declaration of declarations) {
    for (const heritage of declaration.extends ?? []) {
      const base = readHeritage(heritage, scope);
      if (!base.ok) return base;
      Object.assign(fields, base.fields);
    }
    const own = readFields(declaration.body.body, scope);
    if (!own.ok) return own;
    Object.assign(fields, own.fields);
  }
  return { ok: true, fields };
}

function readHeritage(heritage: t.TSInterfaceHeritage, scope: ReadScope): FieldsReading {
  const name = expressionPath(heritage.expression);
  if (name === null) return unreadable('computed base types');
  const label = name.join('.');
  if (heritage.typeArguments) return unreadable(`generic type '${label}'`);
  const binding = scope.bindings.lookup(scope.file, name);
  const base = binding ? readBinding(binding, label, scope) : unreadable(`type '${label}'`);
  if (!base.ok) return base;
  return base.type.kind === 'object'
    ? { ok: true, fields: { ...base.type.fields } }
    : unreadable(`base type '${label}'`);
}

function entityPath(name: t.TSEntityName): string[] | null {
  if (t.isIdentifier(name)) return [name.name];
  if (t.isTSQualifiedName(name)) {
    const left = entityPath(name.left);
    return left && [...left, name.right.name];
  }
  return null;
}

function expressionPath(expression: t.Expression): string[] | null {
  if (t.isIdentifier(expression)) return [expression.name];
  if (
    t.isMemberExpression(expression) &&
    !expression.computed &&
    t.isIdentifier(expression.property) &&
    t.isExpression(expression.object)
  ) {
    const object = expressionPath(expression.object);
    return object && [...object, expression.property.name];
  }
  return null;
}

function propertyName(member: t.TSPropertySignature): string | null {
  const key = member.key;
  if (member.computed) return null;
  if (t.isIdentifier(key)) return key.name;
  if (t.isStringLiteral(key)) return key.value;
  if (t.isNumericLiteral(key)) return String(key.value);
  return null;
}

function unionMembers(type: ConstantType): readonly ConstantType[] {
  return type.kind === 'union' ? type.members : [type];
}

function combine(readings: readonly Reading[], build: (types: ConstantType[]) => ConstantType): Reading {
  const types: ConstantType[] = [];
  let unreadableReading: Reading | null = null;
  for (const reading of readings) {
    if (reading.ok) types.push(reading.type);
    else if (reading.kind === 'unsupported') return reading;
    else unreadableReading ??= reading;
  }
  return unreadableReading ?? { ok: true, type: build(types) };
}

function map(reading: Reading, build: (type: ConstantType) => ConstantType): Reading {
  return reading.ok ? { ok: true, type: build(reading.type) } : reading;
}

function object(reading: FieldsReading): Reading {
  return reading.ok ? { ok: true, type: { kind: 'object', fields: reading.fields } } : reading;
}

function unsupported(reason: string): Failure {
  return { ok: false, kind: 'unsupported', reason };
}

function unreadable(reason: string): Failure {
  return { ok: false, kind: 'unreadable', reason: `${reason} can't be read yet` };
}
