import * as t from '@babel/types';

export type ReactHookName =
  'useState' | 'useRef' | 'useReducer' | 'useEffect' | 'useLayoutEffect' | 'useInsertionEffect' | 'useMemo';

type ReactWrapperName = 'memo' | 'forwardRef' | 'lazy';

export type ReactImports = {
  readonly hooks: ReadonlyMap<string, ReactHookName>;
  readonly wrappers: ReadonlyMap<string, ReactWrapperName>;
  readonly namespaces: ReadonlySet<string>;
};

export type InnerFunction = t.FunctionExpression | t.ArrowFunctionExpression;

export type ComponentSite = { readonly key: string; readonly statement: t.Statement } & (
  | { readonly kind: 'function'; readonly name: string | null; readonly fn: t.FunctionDeclaration }
  | {
      readonly kind: 'variable';
      readonly name: string;
      readonly fn: InnerFunction;
      readonly declarator: t.VariableDeclarator;
    }
  | { readonly kind: 'memo'; readonly name: string; readonly fn: InnerFunction; readonly call: t.CallExpression }
  | {
      readonly kind: 'default-expression';
      readonly fn: InnerFunction;
      readonly declaration: t.ExportDefaultDeclaration;
    }
);

export type HookSite = { readonly fn: t.FunctionDeclaration | InnerFunction };

export type TopLevel = {
  readonly cells: ReadonlyMap<string, t.VariableDeclarator>;
  readonly components: readonly ComponentSite[];
  readonly hooks: readonly HookSite[];
};

const REACT_SOURCE = 'react';
const REACT_HOOK_NAMES: ReadonlySet<string> = new Set<ReactHookName>([
  'useState',
  'useRef',
  'useReducer',
  'useEffect',
  'useLayoutEffect',
  'useInsertionEffect',
  'useMemo',
]);
const REACT_WRAPPER_NAMES: ReadonlySet<string> = new Set<ReactWrapperName>(['memo', 'forwardRef', 'lazy']);
const COMPONENT_NAME = /^[A-Z][A-Za-z0-9]*$/;
const HOOK_NAME = /^use[A-Z0-9]/;
const DEFAULT_EXPORT = 'default';

export function readReactImports(program: t.Program): ReactImports {
  const hooks = new Map<string, ReactHookName>();
  const wrappers = new Map<string, ReactWrapperName>();
  const namespaces = new Set<string>();
  for (const statement of program.body) {
    if (!t.isImportDeclaration(statement) || statement.source.value !== REACT_SOURCE || statement.importKind === 'type')
      continue;
    for (const specifier of statement.specifiers) {
      if (!t.isImportSpecifier(specifier)) {
        namespaces.add(specifier.local.name);
        continue;
      }
      const imported = exportedName(specifier.imported);
      if (isReactHookName(imported)) hooks.set(specifier.local.name, imported);
      if (isReactWrapperName(imported)) wrappers.set(specifier.local.name, imported);
    }
  }
  return { hooks, wrappers, namespaces };
}

export function classifyTopLevel(
  program: t.Program,
  react: ReactImports,
  keyOf: (binding: string) => string
): TopLevel {
  const cells = new Map<string, t.VariableDeclarator>();
  const components: ComponentSite[] = [];
  const hooks: HookSite[] = [];
  for (const statement of program.body) {
    const declaration =
      t.isExportNamedDeclaration(statement) || t.isExportDefaultDeclaration(statement)
        ? statement.declaration
        : statement;
    if (t.isFunctionDeclaration(declaration)) {
      classifyFunction(declaration, statement);
    } else if (t.isVariableDeclaration(declaration) && declaration.kind === 'const' && !declaration.declare) {
      for (const declarator of declaration.declarations) classifyDeclarator(declarator, statement);
    } else if (
      t.isExportDefaultDeclaration(statement) &&
      isInnerFunction(declaration) &&
      isComponent(null, declaration, react)
    ) {
      components.push({
        kind: 'default-expression',
        key: keyOf(DEFAULT_EXPORT),
        statement,
        fn: declaration,
        declaration: statement,
      });
    }
  }
  return { cells, components, hooks };

  function classifyFunction(fn: t.FunctionDeclaration, statement: t.Statement): void {
    const name = fn.id?.name ?? null;
    if (isComponent(name, fn, react))
      components.push({ kind: 'function', key: keyOf(name ?? DEFAULT_EXPORT), statement, name, fn });
    else if (name !== null && HOOK_NAME.test(name)) hooks.push({ fn });
  }

  function classifyDeclarator(declarator: t.VariableDeclarator, statement: t.Statement): void {
    const init = declarator.init;
    if (!init) return;
    const name = t.isIdentifier(declarator.id) ? declarator.id.name : null;
    const wrapper = t.isCallExpression(init) ? reactWrapperOf(init, react) : null;
    if (isInnerFunction(init)) {
      if (name !== null && isComponent(name, init, react)) {
        components.push({ kind: 'variable', key: keyOf(name), statement, name, fn: init, declarator });
      } else if (name !== null && HOOK_NAME.test(name)) {
        hooks.push({ fn: init });
      }
    } else if (wrapper === 'memo' && t.isCallExpression(init)) {
      const inner = init.arguments[0];
      if (name !== null && isInnerFunction(inner) && isComponent(name, inner, react)) {
        components.push({ kind: 'memo', key: keyOf(name), statement, name, fn: inner, call: init });
      }
    } else if (wrapper === null && !t.isClassExpression(init) && !awaitsAtTopLevel(init)) {
      for (const binding of bindingNames(declarator.id)) cells.set(binding, declarator);
    }
  }
}

export function bindingNames(target: t.LVal | t.VoidPattern): readonly string[] {
  return Object.keys(t.getBindingIdentifiers(target));
}

export function isInnerFunction(node: t.Node | null | undefined): node is InnerFunction {
  return t.isFunctionExpression(node) || t.isArrowFunctionExpression(node);
}

export function exportedName(node: t.Identifier | t.StringLiteral): string {
  return t.isIdentifier(node) ? node.name : node.value;
}

export function isReactHookName(name: string): name is ReactHookName {
  return REACT_HOOK_NAMES.has(name);
}

function isReactWrapperName(name: string): name is ReactWrapperName {
  return REACT_WRAPPER_NAMES.has(name);
}

function reactWrapperOf(call: t.CallExpression, react: ReactImports): ReactWrapperName | null {
  const callee = call.callee;
  if (t.isIdentifier(callee)) return react.wrappers.get(callee.name) ?? null;
  const namespaced =
    t.isMemberExpression(callee) &&
    !callee.computed &&
    t.isIdentifier(callee.object) &&
    t.isIdentifier(callee.property) &&
    react.namespaces.has(callee.object.name);
  if (!namespaced || !t.isIdentifier(callee.property)) return null;
  const name = callee.property.name;
  return isReactWrapperName(name) ? name : null;
}

function awaitsAtTopLevel(init: t.Expression): boolean {
  let found = false;
  t.traverseFast(init, (node) => {
    if (t.isFunction(node)) return t.traverseFast.skip;
    if (t.isAwaitExpression(node) || (t.isForOfStatement(node) && node.await)) {
      found = true;
      return t.traverseFast.stop;
    }
  });
  return found;
}

function isComponent(name: string | null, fn: t.Function, react: ReactImports): boolean {
  if (name !== null && !COMPONENT_NAME.test(name)) return false;
  return !fn.async && !fn.generator && rendersOrUsesHooks(fn, react);
}

function rendersOrUsesHooks(fn: t.Function, react: ReactImports): boolean {
  let found = false;
  t.traverseFast(fn.body, (node) => {
    if (t.isJSXElement(node) || t.isJSXFragment(node) || (t.isCallExpression(node) && callsHook(node, react))) {
      found = true;
      return t.traverseFast.stop;
    }
  });
  return found;
}

function callsHook(call: t.CallExpression, react: ReactImports): boolean {
  const callee = call.callee;
  if (t.isIdentifier(callee)) return HOOK_NAME.test(callee.name) || callee.name === 'use';
  return (
    t.isMemberExpression(callee) &&
    t.isIdentifier(callee.object) &&
    react.namespaces.has(callee.object.name) &&
    t.isIdentifier(callee.property) &&
    HOOK_NAME.test(callee.property.name)
  );
}
