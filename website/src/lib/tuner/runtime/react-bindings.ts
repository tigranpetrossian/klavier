import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useDebugValue,
  useEffect,
  useInsertionEffect,
  useLayoutEffect,
  useMemo,
  useReducer,
  useState,
  useSyncExternalStore,
  type DependencyList,
  type EffectCallback,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  changedSince,
  currentWorld,
  popFrame,
  pushFrame,
  runInFrame,
  subscribe,
  topFrame,
  trackingFrame,
  unsubscribe,
  type Deps,
  type Frame,
  type Subscriber,
  type World,
} from './graph';

type Instance = { mounted: boolean; readonly initialDeps: Deps };

type InitialTarget = { readonly deps: Deps | null; readonly world: World };

type Updates = { readonly remount: () => void; readonly rerender: () => void };

type EffectHook = (effect: EffectCallback, deps?: DependencyList) => void;

type MemoEntry<T> = { readonly value: T; readonly reads: Deps };

const ShellContext = createContext<(() => void) | null>(null);
ShellContext.displayName = 'Tuner';

export function useShell<P extends object>(Body: (props: P) => ReactNode, props: P): ReactElement {
  const [generation, setGeneration] = useState(0);
  const remount = useCallback(() => setGeneration((current) => current + 1), []);
  return createElement(ShellContext, { value: remount }, createElement(Body, { ...props, key: generation }));
}

export function useRender(name: string): Frame {
  useDebugValue(name);
  const remount = useContext(ShellContext);
  const [, rerender] = useReducer(increment, 0);
  const [instance] = useState(createInstance);
  const world = useSyncExternalStore(subscribeToNothing, currentWorld, serverWorld);
  const renderDeps: Deps = new Map();
  const frame: Frame = {
    deps: renderDeps,
    initialDeps: instance.mounted ? null : instance.initialDeps,
    rendering: true,
    world,
  };
  useLayoutEffect(() => subscribeInstance(instance, renderDeps, { remount: remount ?? rerender, rerender }));
  pushFrame(frame);
  return frame;
}

export function endRender(frame: Frame): void {
  popFrame(frame);
}

export function initialState(thunk: () => unknown): unknown {
  const target = initialTarget();
  const value = trackInitial(target, thunk);
  return isFunction(value) ? () => trackInitial(target, value) : value;
}

export function initialValue(thunk: () => unknown): unknown {
  return trackInitial(initialTarget(), thunk);
}

export function initialFn(init: unknown): unknown {
  if (!isFunction(init)) return init;
  const target = initialTarget();
  return (...args: unknown[]) => trackInitial(target, () => init(...args));
}

export function useTunedEffect(effect: EffectCallback, deps?: DependencyList): void {
  useTrackedEffect(useEffect, effect, deps);
}

export function useTunedLayoutEffect(effect: EffectCallback, deps?: DependencyList): void {
  useTrackedEffect(useLayoutEffect, effect, deps);
}

export function useTunedInsertionEffect(effect: EffectCallback, deps?: DependencyList): void {
  useTrackedEffect(useInsertionEffect, effect, deps);
}

export function useTunedMemo<T>(factory: () => T, deps?: DependencyList): T {
  const [version, bump] = useReducer(increment, 0);
  const entry = useMemo(
    (): MemoEntry<T> => {
      const reads: Deps = new Map();
      return {
        value: runInFrame({ deps: reads, initialDeps: null, rendering: true, world: renderingWorld() }, factory),
        reads,
      };
    },
    // eslint-disable-next-line react-hooks/use-memo, react-hooks/exhaustive-deps
    withVersion(deps, version)
  );
  useLayoutEffect(() => {
    const subscriber = changeSubscriber(entry.reads, bump);
    subscribe(subscriber, entry.reads);
    subscriber.onChange();
    return () => unsubscribe(subscriber, entry.reads);
  }, [entry]);
  return entry.value;
}

function useTrackedEffect(hook: EffectHook, effect: EffectCallback, deps: DependencyList | undefined): void {
  const [version, bump] = useReducer(increment, 0);
  hook(
    () => {
      const reads: Deps = new Map();
      const cleanup = runInFrame(trackingFrame(reads), effect);
      const subscriber = changeSubscriber(reads, bump);
      subscribe(subscriber, reads);
      return () => {
        unsubscribe(subscriber, reads);
        if (typeof cleanup === 'function') cleanup();
      };
    },
    deps === undefined ? undefined : [...deps, version]
  );
}

function subscribeInstance(instance: Instance, renderDeps: Deps, updates: Updates): () => void {
  instance.mounted = true;
  const subscriber: Subscriber = { kind: 'subscriber', onChange: () => updateInstance(instance, renderDeps, updates) };
  subscribe(subscriber, instance.initialDeps);
  subscribe(subscriber, renderDeps);
  updateInstance(instance, renderDeps, updates);
  return () => {
    unsubscribe(subscriber, instance.initialDeps);
    unsubscribe(subscriber, renderDeps);
  };
}

function updateInstance(instance: Instance, renderDeps: Deps, updates: Updates): void {
  if (changedSince(instance.initialDeps)) updates.remount();
  else if (changedSince(renderDeps)) updates.rerender();
}

function changeSubscriber(reads: Deps, onChange: () => void): Subscriber {
  return {
    kind: 'subscriber',
    onChange: () => {
      if (changedSince(reads)) onChange();
    },
  };
}

function createInstance(): Instance {
  return { mounted: false, initialDeps: new Map() };
}

function initialTarget(): InitialTarget {
  return { deps: topFrame()?.initialDeps ?? null, world: renderingWorld() };
}

function trackInitial(target: InitialTarget, run: () => unknown): unknown {
  return runInFrame({ deps: target.deps, initialDeps: null, rendering: true, world: target.world }, run);
}

function renderingWorld(): World {
  return topFrame()?.world ?? 'tuned';
}

function subscribeToNothing(): () => void {
  return () => {};
}

function serverWorld(): World {
  return 'defaults';
}

function withVersion(deps: DependencyList | undefined, version: number): DependencyList {
  return deps === undefined ? [{}, version] : [...deps, version];
}

function isFunction(value: unknown): value is (...args: unknown[]) => unknown {
  return typeof value === 'function';
}

function increment(count: number): number {
  return count + 1;
}
