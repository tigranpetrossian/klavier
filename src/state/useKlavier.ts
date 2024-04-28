import type React from 'react';
import { useEffect, useReducer, useRef, useCallback } from 'react';

type InternalState = {
  touched: boolean;
  activeKeys: Array<number>;
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

type UseKlavierProps = {
  defaultActiveKeys?: Array<number>;
  activeKeys?: Array<number>;
  onKeyPress?: (midiNumber: number) => void;
  onKeyRelease?: (midiNumber: number) => void;
  onChange?: (activeKeys: Array<number>) => void;
};

type UseKlavierResult = {
  state: {
    activeKeys: Array<number>;
  };
  actions: {
    pressKey: (midiNumber: number) => void;
    releaseKey: (midiNumber: number) => void;
  };
};

function useKlavier(props: UseKlavierProps): UseKlavierResult {
  const { defaultActiveKeys = [], activeKeys, onKeyPress, onKeyRelease, onChange } = props;
  const lastActionRef = useRef<Action | null>(null);
  const [state, dispatch] = useReducer(reducer, {
    touched: false,
    activeKeys: activeKeys ?? defaultActiveKeys,
  });

  useActiveKeysChangeDetection({
    activeKeys: state.activeKeys,
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

  const pressKey = useCallback(
    (midiNumber: number) => {
      toggleNote(midiNumber, 'ON');
      onKeyPress?.(midiNumber);
    },
    [toggleNote, onKeyPress]
  );

  const releaseKey = useCallback(
    (midiNumber: number) => {
      toggleNote(midiNumber, 'OFF');
      onKeyRelease?.(midiNumber);
    },
    [toggleNote, onKeyRelease]
  );

  return {
    state: getControlledState(state, { activeKeys }),
    actions: {
      pressKey,
      releaseKey,
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
          activeKeys: [action.payload],
        };
      }
      return {
        ...state,
        activeKeys: state.activeKeys.includes(action.payload)
          ? state.activeKeys
          : [...state.activeKeys, action.payload],
      };

    case 'NOTE_OFF':
      return {
        ...state,
        activeKeys: state.activeKeys.filter((note) => note !== action.payload),
      };

    default:
      return state;
  }
}

type UseStateChangeDetectionProps = {
  lastActionRef: React.MutableRefObject<Action | null>;
  onChange?: (activeKeys: Array<number>) => void;
  activeKeys: Array<number>;
};

function useActiveKeysChangeDetection(props: UseStateChangeDetectionProps) {
  const { activeKeys, lastActionRef, onChange } = props;

  useEffect(() => {
    if (!lastActionRef.current) {
      return;
    }
    onChange?.(activeKeys);
    lastActionRef.current = null;
  }, [activeKeys, lastActionRef, onChange]);
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

export type { UseKlavierResult, UseKlavierProps };
export { useKlavier };
