import * as t from '@babel/types';
import { RUNTIME_ENTRY, toPosix } from './transform-scope.ts';
import path from 'node:path';

export const RUNTIME = '__t';
export const MODULE_TOKEN = '__m';

export function runtimeMember(name: string): t.MemberExpression {
  return t.memberExpression(t.identifier(RUNTIME), t.identifier(name));
}

export function runtimeCall(name: string, args: t.CallExpression['arguments']): t.CallExpression {
  return t.callExpression(runtimeMember(name), args);
}

export function withLoc<T extends t.Node>(node: T, from: t.Node): T {
  node.loc = from.loc;
  return node;
}

export function runtimeImport(file: string): t.ImportDeclaration {
  const relative = toPosix(path.relative(path.dirname(file), RUNTIME_ENTRY));
  const specifier = relative.startsWith('.') ? relative : `./${relative}`;
  return t.importDeclaration([t.importNamespaceSpecifier(t.identifier(RUNTIME))], t.stringLiteral(specifier));
}
