import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { RenderHookResult } from '@testing-library/react';
import type { UseKlavierProps, UseKlavierResult } from 'useKlavier';
import { useKlavier } from 'useKlavier';

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
    result.current.actions.playNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).toContain(midiNumber);
  });

  it('should remove stopped note from active notes list', () => {
    result.current.actions.playNote(midiNumber);
    rerender();
    result.current.actions.stopNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).not.toContain(midiNumber);
  });
});

describe('Given default active notes (uncontrolled mode)', () => {
  const props = {
    defaultActiveNotes: [21, 23, 25],
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
      activeNotes: props.defaultActiveNotes,
      touched: false,
    });
  });

  it('should clear default active notes upon first play', () => {
    result.current.actions.playNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).toEqual([midiNumber]);
  });
});

describe('Given callback props', () => {
  const onChange = vi.fn().mockImplementation(() => undefined);
  const onPlayNote = vi.fn().mockImplementation(() => undefined);
  const onStopNote = vi.fn().mockImplementation(() => undefined);
  const props: UseKlavierProps = {
    onChange,
    onPlayNote,
    onStopNote,
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
    result.current.actions.playNote(midiNumber);
    rerender();
    expect(onChange).toHaveBeenCalledWith([midiNumber]);
  });

  it('should execute onPlayNote with the correct parameter', () => {
    result.current.actions.playNote(midiNumber);
    expect(onPlayNote).toHaveBeenCalledWith(midiNumber);
  });

  it('should execute onStopNote with the correct parameter', () => {
    result.current.actions.playNote(midiNumber);
    rerender();
    result.current.actions.stopNote(midiNumber);
    expect(onStopNote).toHaveBeenCalledWith(midiNumber);
  });
});

describe('Given active notes and no callbacks (controlled mode)', () => {
  const props = {
    activeNotes: [21, 23, 25],
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
      activeNotes: props.activeNotes,
      touched: false,
    });
  });

  it('should not alter active notes from within', () => {
    result.current.actions.playNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).toEqual(props.activeNotes);
  });
});

describe('Given active notes and callbacks (controlled mode)', () => {
  const onChange = vi.fn().mockImplementation(() => undefined);
  const initialProps = {
    activeNotes: [21, 23, 25],
    onChange,
  };
  const newProps = {
    activeNotes: [30, 31, 31],
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

  it('should not execute onChange when activeNotes prop was changed from outside', () => {
    rerender(newProps);
    expect(result.current.state.activeNotes).toEqual(newProps.activeNotes);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('should execute onChange when activeNotes prop was changed in response to action', () => {
    result.current.actions.playNote(midiNumber);
    rerender(initialProps);
    expect(onChange).toHaveBeenCalled();
  });
});
