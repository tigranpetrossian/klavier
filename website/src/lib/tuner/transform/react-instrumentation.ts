import * as t from '@babel/types';
import { runtimeCall, runtimeMember, withLoc } from './runtime-calls.ts';
import type { ComponentSite, InnerFunction, ReactHookName } from './top-level-declarations.ts';

type InitialWrapper = { readonly runtime: 'initialState' | 'initialValue' | 'initialFn'; readonly thunk: boolean };

type HookRewrite = {
  readonly ownReads: 'all-arguments' | 'first-argument';
  readonly rewrite: (call: t.CallExpression) => void;
};

const RENDER_FRAME = '__r';
const SHELL_PROPS = 'props';
const NO_MEMO = 'use no memo';
const DEFAULT_BODY = 'default';
const INITIAL_STATE: InitialWrapper = { runtime: 'initialState', thunk: true };
const INITIAL_VALUE: InitialWrapper = { runtime: 'initialValue', thunk: true };
const INITIAL_FN: InitialWrapper = { runtime: 'initialFn', thunk: false };

export const HOOK_REWRITES: Record<ReactHookName, HookRewrite> = {
  useState: { ownReads: 'all-arguments', rewrite: (call) => wrapArguments(call, [INITIAL_STATE]) },
  useRef: { ownReads: 'all-arguments', rewrite: (call) => wrapArguments(call, [INITIAL_VALUE]) },
  useReducer: { ownReads: 'all-arguments', rewrite: (call) => wrapArguments(call, [null, INITIAL_VALUE, INITIAL_FN]) },
  useEffect: { ownReads: 'first-argument', rewrite: (call) => replaceCallee(call, 'useTunedEffect') },
  useLayoutEffect: { ownReads: 'first-argument', rewrite: (call) => replaceCallee(call, 'useTunedLayoutEffect') },
  useInsertionEffect: { ownReads: 'first-argument', rewrite: (call) => replaceCallee(call, 'useTunedInsertionEffect') },
  useMemo: { ownReads: 'first-argument', rewrite: (call) => replaceCallee(call, 'useTunedMemo') },
};

export function instrumentComponent(site: ComponentSite, staticReads: readonly t.Statement[]): t.FunctionDeclaration {
  const bodyName = `${componentName(site) ?? DEFAULT_BODY}$body`;
  const body = bodyDeclaration(bodyName, site.fn, site.key, staticReads);
  switch (site.kind) {
    case 'function':
      site.fn.params = [t.identifier(SHELL_PROPS)];
      site.fn.body = shellBlock(bodyName);
      site.fn.typeParameters = null;
      site.fn.returnType = null;
      break;
    case 'variable':
      site.declarator.init = shellFunction(site.name, bodyName);
      break;
    case 'memo':
      site.call.arguments[0] = shellFunction(site.name, bodyName);
      break;
    case 'default-expression':
      site.declaration.declaration = t.functionDeclaration(null, [t.identifier(SHELL_PROPS)], shellBlock(bodyName));
      break;
  }
  return body;
}

function bodyDeclaration(
  name: string,
  fn: t.FunctionDeclaration | InnerFunction,
  key: string,
  staticReads: readonly t.Statement[]
): t.FunctionDeclaration {
  const original = t.isBlockStatement(fn.body) ? fn.body : t.blockStatement([t.returnStatement(fn.body)]);
  const block = t.blockStatement(
    [
      t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(RENDER_FRAME), runtimeCall('useRender', [t.stringLiteral(key)])),
      ]),
      t.tryStatement(
        t.blockStatement([...staticReads, ...original.body]),
        null,
        t.blockStatement([t.expressionStatement(runtimeCall('endRender', [t.identifier(RENDER_FRAME)]))])
      ),
    ],
    [...original.directives, t.directive(t.directiveLiteral(NO_MEMO))]
  );
  const body = t.functionDeclaration(t.identifier(name), fn.params, block);
  body.typeParameters = fn.typeParameters;
  body.returnType = fn.returnType;
  return withLoc(body, fn);
}

function shellBlock(bodyName: string): t.BlockStatement {
  return t.blockStatement([
    t.returnStatement(runtimeCall('useShell', [t.identifier(bodyName), t.identifier(SHELL_PROPS)])),
  ]);
}

function shellFunction(name: string, bodyName: string): t.FunctionExpression {
  return t.functionExpression(t.identifier(name), [t.identifier(SHELL_PROPS)], shellBlock(bodyName));
}

export function prependStatements(fn: t.FunctionDeclaration | InnerFunction, statements: readonly t.Statement[]): void {
  fn.body = t.isBlockStatement(fn.body)
    ? t.blockStatement([...statements, ...fn.body.body], fn.body.directives)
    : t.blockStatement([...statements, t.returnStatement(fn.body)]);
}

export function componentName(site: ComponentSite): string | null {
  return site.kind === 'default-expression' ? null : site.name;
}

function wrapArguments(call: t.CallExpression, wrappers: readonly (InitialWrapper | null)[]): void {
  call.arguments = call.arguments.map((argument, index) => {
    const wrapper = wrappers[index];
    if (!wrapper || !t.isExpression(argument)) return argument;
    const wrapped = wrapper.thunk ? t.arrowFunctionExpression([], argument) : argument;
    return withLoc(runtimeCall(wrapper.runtime, [wrapped]), argument);
  });
}

function replaceCallee(call: t.CallExpression, runtimeName: string): void {
  call.callee = withLoc(runtimeMember(runtimeName), call.callee);
}
