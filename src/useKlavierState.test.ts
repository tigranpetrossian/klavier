import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useKlavierState } from 'useKlavierState.ts';

describe('useKlavierState', () => {
  const initialActiveNotes = [21, 23, 25];

  it('should correctly initialize with given active notes', () => {
    const { result } = renderHook(() => useKlavierState(initialActiveNotes));
    expect(result.current.state).toEqual({
      activeNotes: initialActiveNotes,
      mouseActive: false,
      touched: false,
    });
  });

  it('should clear initial active notes upon first play', () => {
    const midiNumber = 10;
    const { result, rerender } = renderHook(() => useKlavierState(initialActiveNotes));
    result.current.actions.playNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).toEqual([midiNumber]);
  });

  it('should add played note to active notes list', () => {
    const midiNumber = 10;
    const { result, rerender } = renderHook(() => useKlavierState(initialActiveNotes));
    result.current.actions.playNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).toContain(midiNumber);
  });

  it('should remove stopped note from active notes list', () => {
    const midiNumber = 10;
    const { result, rerender } = renderHook(() => useKlavierState(initialActiveNotes));
    result.current.actions.playNote(midiNumber);
    rerender();
    result.current.actions.stopNote(midiNumber);
    rerender();
    expect(result.current.state.activeNotes).not.toContain(midiNumber);
  });
});
