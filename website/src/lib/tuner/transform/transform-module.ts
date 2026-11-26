import { generate, type GeneratorResult } from '@babel/generator';
import traverse, { type NodePath } from '@babel/traverse';
import * as t from '@babel/types';
import { wrapCells } from './cell-declarations.ts';
import { cellKey, createCellResolver, hasDirective, type CellResolver } from './exported-cells.ts';
import { parseModule } from './parse-module.ts';
import { createProjectModules, type ProjectModules } from './project-modules.ts';
import { componentName, HOOK_REWRITES, instrumentComponent, prependStatements } from './react-instrumentation.ts';
import { MODULE_TOKEN, runtimeCall, runtimeImport, runtimeMember, withLoc } from './runtime-calls.ts';
import {
  bindingNames,
  classifyTopLevel,
  exportedName,
  isReactHookName,
  readReactImports,
  type ReactHookName,
  type ReactImports,
  type TopLevel,
} from './top-level-declarations.ts';
import { createScope, TUNABLE_FILE, type TransformOptions, type TransformScope } from './transform-scope.ts';
import { createTypeBindings, type TypeBindings } from './type-bindings.ts';
import { readTypeArgument } from './type-reader.ts';
import path from 'node:path';

export type { TransformOptions } from './transform-scope.ts';

export type TransformResult = {
  readonly code: string;
  readonly map: GeneratorResult['map'];
  readonly dependencies: readonly string[];
};

type ModuleContext = {
  readonly file: string;
  readonly scope: TransformScope;
  readonly react: ReactImports;
  readonly topLevel: TopLevel;
  readonly markers: ReadonlySet<string>;
  readonly markerNamespaces: ReadonlySet<string>;
  readonly types: TypeBindings;
  readonly importedCells: ReadonlyMap<string, string>;
  readonly cellNamespaces: ReadonlyMap<string, string>;
  readonly resolveCell: CellResolver;
};

type Owner = { readonly staticReads: Map<string, t.Expression> };

type Rewrites = { reads: number; markers: number; hooks: number };

const MARKER_EXPORT = 'tunable';

const HOT_ACCEPT =
  'if (import.meta.turbopackHot) { import.meta.turbopackHot.accept(); globalThis.$RefreshHelpers$?.scheduleUpdate(); }';

export function transformModule(source: string, options: TransformOptions): TransformResult | null {
  const scope = createScope(options);
  const file = path.resolve(options.file);
  if (!scope.isAppFile(file)) return null;
  const ast = parseModule(source, file);
  if (!ast || hasDirective(ast.program, 'use server')) return null;
  const dependencies = new Set<string>();
  const project = createProjectModules(scope.root, dependencies);
  const context = readModuleContext(ast.program, file, scope, project);
  const owners = ownersOf(context.topLevel);
  const rewrites = rewriteExpressions(ast, context, owners);
  if (!restructure(ast.program, context, owners, rewrites)) return null;
  const output = generate(ast, { sourceMaps: true, sourceFileName: file }, source);
  return { code: output.code, map: output.map, dependencies: [...dependencies] };
}

function readModuleContext(
  program: t.Program,
  file: string,
  scope: TransformScope,
  project: ProjectModules
): ModuleContext {
  const react = readReactImports(program);
  const resolveCell = createCellResolver(scope, project);
  const markers = new Set<string>();
  const markerNamespaces = new Set<string>();
  const importedCells = new Map<string, string>();
  const cellNamespaces = new Map<string, string>();
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement)) continue;
    const target = project.resolve(statement.source.value, file);
    if (target === TUNABLE_FILE) {
      for (const specifier of statement.specifiers) {
        if (t.isImportNamespaceSpecifier(specifier)) markerNamespaces.add(specifier.local.name);
        if (t.isImportSpecifier(specifier) && exportedName(specifier.imported) === MARKER_EXPORT)
          markers.add(specifier.local.name);
      }
    } else if (target && scope.isAppFile(target) && statement.importKind !== 'type') {
      for (const specifier of statement.specifiers) {
        if (t.isImportNamespaceSpecifier(specifier)) cellNamespaces.set(specifier.local.name, target);
        if (!t.isImportSpecifier(specifier) || specifier.importKind === 'type') continue;
        const key = resolveCell(target, exportedName(specifier.imported));
        if (key) importedCells.set(specifier.local.name, key);
      }
    }
  }
  return {
    file,
    scope,
    react,
    topLevel: classifyTopLevel(program, react, (binding) => cellKey(scope, file, binding)),
    markers,
    markerNamespaces,
    types: createTypeBindings(project, file, program),
    importedCells,
    cellNamespaces,
    resolveCell,
  };
}

function ownersOf(topLevel: TopLevel): Map<t.Node, Owner> {
  const owners = new Map<t.Node, Owner>();
  for (const site of [...topLevel.components, ...topLevel.hooks]) owners.set(site.fn, { staticReads: new Map() });
  return owners;
}

function rewriteExpressions(ast: t.File, context: ModuleContext, owners: ReadonlyMap<t.Node, Owner>): Rewrites {
  const rewrites: Rewrites = { reads: 0, markers: 0, hooks: 0 };
  const synthesized = new WeakSet<t.Node>();

  traverse(ast, {
    Identifier(identifier) {
      if (synthesized.has(identifier.node) || !isValueRead(identifier)) return;
      const key = identifierCellKey(identifier);
      if (key !== null) replaceWithRead(identifier, key, t.identifier(identifier.node.name));
    },
    MemberExpression(member) {
      if (synthesized.has(member.node)) return;
      const key = namespaceCellKey(member);
      const { object, property } = member.node;
      if (key !== null && t.isIdentifier(object) && t.isIdentifier(property)) {
        replaceWithRead(member, key, t.memberExpression(t.identifier(object.name), t.identifier(property.name)));
      }
    },
    CallExpression: {
      exit(call) {
        if (synthesized.has(call.node)) return;
        if (isMarkerCall(call)) {
          rewriteMarker(call.node, context);
          rewrites.markers++;
          return;
        }
        const hook = reactHookOf(call);
        if (hook === null || !call.findParent((ancestor) => owners.has(ancestor.node))) return;
        HOOK_REWRITES[hook].rewrite(call.node);
        synthesized.add(call.node);
        rewrites.hooks++;
      },
    },
  });
  return rewrites;

  function identifierCellKey(identifier: NodePath<t.Identifier>): string | null {
    const name = identifier.node.name;
    const binding = identifier.scope.getBinding(name);
    if (!binding || binding.scope !== identifier.scope.getProgramParent()) return null;
    if (binding.kind === 'module') return context.importedCells.get(name) ?? null;
    return binding.kind === 'const' && context.topLevel.cells.has(name)
      ? cellKey(context.scope, context.file, name)
      : null;
  }

  function namespaceCellKey(member: NodePath<t.MemberExpression>): string | null {
    const { object, property, computed } = member.node;
    if (computed || !t.isIdentifier(object) || !t.isIdentifier(property) || isWriteTarget(member)) return null;
    const file = context.cellNamespaces.get(object.name);
    if (!file || member.scope.getBinding(object.name)?.kind !== 'module') return null;
    return context.resolveCell(file, property.name);
  }

  function replaceWithRead(
    target: NodePath<t.Identifier | t.MemberExpression>,
    key: string,
    binding: t.Expression
  ): void {
    recordStaticRead(target, key, binding);
    synthesized.add(binding);
    const parent = target.parent;
    if (t.isObjectProperty(parent) && parent.shorthand) parent.shorthand = false;
    target.replaceWith(withLoc(runtimeCall('read', [t.stringLiteral(key), binding]), target.node));
    target.skip();
    rewrites.reads++;
  }

  function recordStaticRead(target: NodePath, key: string, binding: t.Expression): void {
    let child: NodePath = target;
    let ancestor = target.parentPath;
    let inClosure = false;
    while (ancestor) {
      const owner = owners.get(ancestor.node);
      if (owner) {
        if (inClosure) owner.staticReads.set(key, t.cloneNode(binding));
        return;
      }
      if (ancestor.isCallExpression() && tracksOwnReads(ancestor, child.node)) return;
      if (ancestor.isFunction()) inClosure = true;
      child = ancestor;
      ancestor = ancestor.parentPath;
    }
  }

  function tracksOwnReads(call: NodePath<t.CallExpression>, argument: t.Node): boolean {
    const hook = reactHookOf(call);
    if (hook === null) return false;
    const args = call.node.arguments;
    return HOOK_REWRITES[hook].ownReads === 'all-arguments'
      ? args.some((arg) => arg === argument)
      : args[0] === argument;
  }

  function isMarkerCall(call: NodePath<t.CallExpression>): boolean {
    const callee = call.node.callee;
    if (t.isIdentifier(callee)) return context.markers.has(callee.name) && isImportBinding(call, callee.name);
    return (
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      t.isIdentifier(callee.property) &&
      callee.property.name === MARKER_EXPORT &&
      context.markerNamespaces.has(callee.object.name) &&
      isImportBinding(call, callee.object.name)
    );
  }

  function reactHookOf(call: NodePath<t.CallExpression>): ReactHookName | null {
    const callee = call.node.callee;
    if (t.isIdentifier(callee)) {
      const hook = context.react.hooks.get(callee.name);
      return hook && isImportBinding(call, callee.name) ? hook : null;
    }
    const namespaced =
      t.isMemberExpression(callee) &&
      t.isIdentifier(callee.object) &&
      t.isIdentifier(callee.property) &&
      context.react.namespaces.has(callee.object.name) &&
      isImportBinding(call, callee.object.name);
    if (!namespaced || !t.isIdentifier(callee.property)) return null;
    const name = callee.property.name;
    return isReactHookName(name) ? name : null;
  }
}

function restructure(
  program: t.Program,
  context: ModuleContext,
  owners: ReadonlyMap<t.Node, Owner>,
  rewrites: Rewrites
): boolean {
  const { cells, components, hooks } = context.topLevel;
  const hookReads = hooks.filter((hook) => (owners.get(hook.fn)?.staticReads.size ?? 0) > 0);
  const changed =
    cells.size > 0 ||
    components.length > 0 ||
    hookReads.length > 0 ||
    Object.values(rewrites).some((count) => count > 0);
  if (!changed) return false;
  const liveExports = exportsOnlyLiveBindings(program, context.topLevel);
  const prefixes = new Map<t.Statement, t.Statement[]>();
  const addPrefix = (statement: t.Statement, prefix: t.Statement) =>
    prefixes.set(statement, [...(prefixes.get(statement) ?? []), prefix]);
  wrapCells(program, cells, (binding) => cellKey(context.scope, context.file, binding), addPrefix);
  for (const site of components) addPrefix(site.statement, instrumentComponent(site, staticReadsOf(owners, site.fn)));
  for (const hook of hookReads) prependStatements(hook.fn, staticReadsOf(owners, hook.fn));
  program.body = program.body.flatMap((statement) => [...(prefixes.get(statement) ?? []), statement]);
  const needsModuleToken = cells.size > 0 || rewrites.markers > 0;
  program.body.unshift(runtimeImport(context.file), ...(needsModuleToken ? [moduleTokenDeclaration(context)] : []));
  if (liveExports) program.body.push(...hotAccept());
  return true;
}

function staticReadsOf(owners: ReadonlyMap<t.Node, Owner>, fn: t.Node): readonly t.Statement[] {
  const reads = owners.get(fn)?.staticReads ?? new Map<string, t.Expression>();
  return [...reads].map(([key, binding]) =>
    t.expressionStatement(runtimeCall('read', [t.stringLiteral(key), binding]))
  );
}

function rewriteMarker(call: t.CallExpression, context: ModuleContext): void {
  const [id, value] = call.arguments;
  const typeArguments = t.isTSTypeParameterInstantiation(call.typeArguments) ? call.typeArguments.params : [];
  const typeInfo = readTypeArgument(typeArguments[0], context.file, context.types);
  call.callee = runtimeMember(MARKER_EXPORT);
  call.arguments = [
    t.identifier(MODULE_TOKEN),
    id ?? t.identifier('undefined'),
    value ?? t.identifier('undefined'),
    t.valueToNode(typeInfo),
    t.numericLiteral(call.loc?.start.line ?? 0),
  ];
  call.typeArguments = null;
}

function exportsOnlyLiveBindings(program: t.Program, topLevel: TopLevel): boolean {
  const live = new Set([...topLevel.cells.keys(), ...topLevel.components.map(componentName)]);
  const defaultIsComponent = topLevel.components.some((site) => t.isExportDefaultDeclaration(site.statement));
  let exported = 0;
  for (const statement of program.body) {
    if (t.isExportAllDeclaration(statement)) {
      if (statement.exportKind !== 'type') return false;
    } else if (t.isExportDefaultDeclaration(statement)) {
      if (!defaultIsComponent) return false;
      exported++;
    } else if (t.isExportNamedDeclaration(statement) && statement.exportKind !== 'type') {
      if (statement.source) return false;
      const names = exportedLocalNames(statement);
      if (names === null || !names.every((name) => live.has(name))) return false;
      exported += names.length;
    }
  }
  return exported > 0;
}

function exportedLocalNames(statement: t.ExportNamedDeclaration): readonly string[] | null {
  const declaration = statement.declaration;
  const specifiers = statement.specifiers.flatMap((specifier) =>
    t.isExportSpecifier(specifier) && specifier.exportKind !== 'type' ? [exportedName(specifier.local)] : []
  );
  if (!declaration) return specifiers;
  if (t.isVariableDeclaration(declaration))
    return declaration.declarations.flatMap((declarator) => bindingNames(declarator.id));
  if (t.isFunctionDeclaration(declaration)) return declaration.id ? [declaration.id.name] : null;
  return t.isTSTypeAliasDeclaration(declaration) || t.isTSInterfaceDeclaration(declaration) ? [] : null;
}

function moduleTokenDeclaration(context: ModuleContext): t.VariableDeclaration {
  const token = runtimeCall('module', [t.stringLiteral(context.scope.relative(context.file))]);
  return t.variableDeclaration('const', [t.variableDeclarator(t.identifier(MODULE_TOKEN), token)]);
}

function hotAccept(): t.Statement[] {
  const statements = parseModule(HOT_ACCEPT, 'hot-accept.ts')?.program.body ?? [];
  return statements.map((statement) => t.cloneNode(statement, true, true));
}

function isValueRead(identifier: NodePath<t.Identifier>): boolean {
  if (!identifier.isReferencedIdentifier()) return false;
  if (identifier.parentPath?.isExportSpecifier() || isWriteTarget(identifier)) return false;
  return identifier.findParent(isTypePosition) === null;
}

function isWriteTarget(target: NodePath): boolean {
  const parent = target.parent;
  return (t.isAssignmentExpression(parent) && parent.left === target.node) || t.isUpdateExpression(parent);
}

function isTypePosition(ancestor: NodePath): boolean {
  return (
    ancestor.isTSType() ||
    ancestor.isTSTypeAnnotation() ||
    ancestor.isTSTypeParameterInstantiation() ||
    ancestor.isTSTypeParameterDeclaration() ||
    ancestor.isTSInterfaceDeclaration() ||
    ancestor.isTSTypeAliasDeclaration()
  );
}

function isImportBinding(target: NodePath, name: string): boolean {
  return target.scope.getBinding(name)?.kind === 'module';
}
