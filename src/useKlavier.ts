import type React from 'react';
import { useEffect, useReducer, useRef, useCallback } from 'react';

type InternalState = {
  touched: boolean;
  activeNotes: Array<number>;
};

type Action =
  | {
      type: 'NOTE_ON';
      payload: number;
    }
  | {
      type: 'NOTE_OFF';
      payload: number;
    };

export type UseKlavierProps = {
  defaultActiveNotes?: Array<number>;
  activeNotes?: Array<number>;
  onPlayNote?: (midiNumber: number) => void;
  onStopNote?: (midiNumber: number) => void;
  onChange?: (activeNotes: Array<number>) => void;
};

export type UseKlavierResult = {
  state: {
    activeNotes: Array<number>;
  };
  actions: {
    playNote: (midiNumber: number) => void;
    stopNote: (midiNumber: number) => void;
  };
};

export function useKlavier(props: UseKlavierProps): UseKlavierResult {
  const { defaultActiveNotes = [], activeNotes, onPlayNote, onStopNote, onChange } = props;
  const lastActionRef = useRef<Action | null>(null);
  const [state, dispatch] = useReducer(reducer, {
    touched: false,
    activeNotes: activeNotes ?? defaultActiveNotes,
  });

  useActiveNotesChangeDetection({
    activeNotes: state.activeNotes,
    lastActionRef,
    onChange,
  });

  const toggleNote = useCallback(
    (midiNumber: number, state: 'ON' | 'OFF') => {
      const action: Action = {
        type: `NOTE_${state}`,
        payload: midiNumber,
      };
      lastActionRef.current = action;
      dispatch(action);
    },
    [dispatch]
  );

  const playNote = useCallback(
    (midiNumber: number) => {
      toggleNote(midiNumber, 'ON');
      onPlayNote?.(midiNumber);
    },
    [toggleNote, onPlayNote]
  );

  const stopNote = useCallback(
    (midiNumber: number) => {
      toggleNote(midiNumber, 'OFF');
      onStopNote?.(midiNumber);
    },
    [toggleNote, onStopNote]
  );

  return {
    state: getControlledState(state, { activeNotes }),
    actions: {
      playNote,
      stopNote,
    },
  };
}

function reducer(state: InternalState, action: Action) {
  switch (action.type) {
    case 'NOTE_ON':
      if (!state.touched) {
        return {
          ...state,
          touched: true,
          activeNotes: [action.payload],
        };
      }
      return {
        ...state,
        activeNotes: state.activeNotes.includes(action.payload)
          ? state.activeNotes
          : [...state.activeNotes, action.payload],
      };

    case 'NOTE_OFF':
      return {
        ...state,
        activeNotes: state.activeNotes.filter((note) => note !== action.payload),
      };

    default:
      return state;
  }
}

type UseStateChangeDetectionParams = {
  lastActionRef: React.MutableRefObject<Action | null>;
  onChange?: (activeNotes: Array<number>) => void;
  activeNotes: Array<number>;
};

function useActiveNotesChangeDetection(params: UseStateChangeDetectionParams) {
  const { activeNotes, lastActionRef, onChange } = params;

  useEffect(() => {
    if (!lastActionRef.current) {
      return;
    }
    onChange?.(activeNotes);
    lastActionRef.current = null;
  }, [activeNotes, lastActionRef, onChange]);
}

function getControlledState<State>(internalState: State, controlledProps: Partial<State>) {
  const augmentedState = { ...internalState };
  (Object.keys(controlledProps) as (keyof State)[]).forEach((key) => {
    if (controlledProps[key] !== undefined) {
      (augmentedState as Record<keyof State, unknown>)[key] = controlledProps[key];
    }
  });

  return augmentedState;
}
