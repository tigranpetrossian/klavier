import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RenderHookResult } from '@testing-library/react';
import type { UseKlavierProps, UseKlavierResult } from 'state/useKlavier';
import { useKlavier } from 'state/useKlavier';

describe('Given no parameters (uncontrolled mode)', () => {
  const props = {};
  const midiNumber = 10;
  let rerender: RenderHookResult<UseKlavierResult, UseKlavierProps>['rerender'];
  let result: RenderHookResult<UseKlavierResult, UseKlavierProps>['result'];

  beforeEach(() => {
    const rendered = renderHook(() => useKlavier(props));
    result = rendered.result;
    rerender = rendered.rerender;
  });

  it('should add played note to active notes list', () => {
    result.current.actions.pressKey(midiNumber);
    rerender();
    expect(result.current.state.activeKeys).toContain(midiNumber);
  });

  it('should remove stopped note from active notes list', () => {
    result.current.actions.pressKey(midiNumber);
    rerender();
    result.current.actions.releaseKey(midiNumber);
    rerender();
    expect(result.current.state.activeKeys).not.toContain(midiNumber);
  });
});

describe('Given default active notes (uncontrolled mode)', () => {
  const props = {
    defaultActiveKeys: [21, 23, 25],
  };
  const midiNumber = 10;
  let rerender: RenderHookResult<UseKlavierResult, UseKlavierProps>['rerender'];
  let result: RenderHookResult<UseKlavierResult, UseKlavierProps>['result'];

  beforeEach(() => {
    const rendered = renderHook(() => useKlavier(props));
    result = rendered.result;
    rerender = rendered.rerender;
  });

  it('should correctly initialize with given default active notes', () => {
    expect(result.current.state).toEqual({
      activeKeys: props.defaultActiveKeys,
      touched: false,
    });
  });

  it('should clear default active notes upon first play', () => {
    result.current.actions.pressKey(midiNumber);
    rerender();
    expect(result.current.state.activeKeys).toEqual([midiNumber]);
  });
});

describe('Given callback props', () => {
  const onChange = vi.fn().mockImplementation(() => undefined);
  const onKeyPress = vi.fn().mockImplementation(() => undefined);
  const onKeyRelease = vi.fn().mockImplementation(() => undefined);
  const props: UseKlavierProps = {
    onChange,
    onKeyPress,
    onKeyRelease,
  };
  const midiNumber = 10;
  let rerender: RenderHookResult<UseKlavierResult, UseKlavierProps>['rerender'];
  let result: RenderHookResult<UseKlavierResult, UseKlavierProps>['result'];

  beforeEach(() => {
    const rendered = renderHook(() => useKlavier(props));
    result = rendered.result;
    rerender = rendered.rerender;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute onChange with the correct parameter', () => {
    result.current.actions.pressKey(midiNumber);
    rerender();
    expect(onChange).toHaveBeenCalledWith([midiNumber]);
  });

  it('should execute onKeyPress with the correct parameter', () => {
    result.current.actions.pressKey(midiNumber);
    expect(onKeyPress).toHaveBeenCalledWith(midiNumber);
  });

  it('should execute onKeyRelease with the correct parameter', () => {
    result.current.actions.pressKey(midiNumber);
    rerender();
    result.current.actions.releaseKey(midiNumber);
    expect(onKeyRelease).toHaveBeenCalledWith(midiNumber);
  });
});

describe('Given active notes and no callbacks (controlled mode)', () => {
  const props = {
    activeKeys: [21, 23, 25],
  };
  const midiNumber = 10;
  let rerender: RenderHookResult<UseKlavierResult, UseKlavierProps>['rerender'];
  let result: RenderHookResult<UseKlavierResult, UseKlavierProps>['result'];

  beforeEach(() => {
    const rendered = renderHook(() => useKlavier(props));
    result = rendered.result;
    rerender = rendered.rerender;
  });

  it('should correctly initialize with given default active notes', () => {
    expect(result.current.state).toEqual({
      activeKeys: props.activeKeys,
      touched: false,
    });
  });

  it('should not alter active notes from within', () => {
    result.current.actions.pressKey(midiNumber);
    rerender();
    expect(result.current.state.activeKeys).toEqual(props.activeKeys);
  });
});

describe('Given active notes and callbacks (controlled mode)', () => {
  const onChange = vi.fn().mockImplementation(() => undefined);
  const initialProps = {
    activeKeys: [21, 23, 25],
    onChange,
  };
  const newProps = {
    activeKeys: [30, 31, 31],
    onChange,
  };
  const midiNumber = 10;
  let rerender: RenderHookResult<UseKlavierResult, UseKlavierProps>['rerender'];
  let result: RenderHookResult<UseKlavierResult, UseKlavierProps>['result'];

  beforeEach(() => {
    const rendered = renderHook(useKlavier, { initialProps });
    result = rendered.result;
    rerender = rendered.rerender;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should not execute onChange when activeKeys prop was changed from outside', () => {
    rerender(newProps);
    expect(result.current.state.activeKeys).toEqual(newProps.activeKeys);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should execute onChange when activeKeys prop was changed in response to action', () => {
    result.current.actions.pressKey(midiNumber);
    rerender(initialProps);
    expect(onChange).toHaveBeenCalled();
  });
});
