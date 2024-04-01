import { useReducer } from 'react';

type InternalState = {
  touched: boolean;
  mouseActive: boolean;
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
    }
  | {
      type: 'SET_MOUSE_ACTIVE';
      payload: boolean;
    };

type UseKlavierProps = {
  defaultActiveNotes?: Array<number>;
  activeNotes?: Array<number>;
  onPlayNote?: (midiNumber: number) => void;
  onStopNote?: (midiNumber: number) => void;
};

type UseKlavierResult = {
  state: {
    activeNotes: Array<number>;
    mouseActive: boolean;
  };
  actions: {
    playNote: (midiNumber: number) => void;
    stopNote: (midiNumber: number) => void;
    setMouseActive: (active: boolean) => void;
  };
};

export function useKlavier(props: UseKlavierProps): UseKlavierResult {
  const { defaultActiveNotes = [], activeNotes, onPlayNote, onStopNote } = props;

  const [state, dispatch] = useReducer(reducer, {
    touched: false,
    mouseActive: false,
    activeNotes: activeNotes ?? defaultActiveNotes,
  });

  const playNote = (midiNumber: number) => {
    dispatch({ type: 'NOTE_ON', payload: midiNumber });
    onPlayNote?.(midiNumber);
  };

  const stopNote = (midiNumber: number) => {
    dispatch({ type: 'NOTE_OFF', payload: midiNumber });
    onStopNote?.(midiNumber);
  };

  const setMouseActive = (isActive: boolean) => {
    dispatch({ type: 'SET_MOUSE_ACTIVE', payload: isActive });
  };

  return {
    state: getControlledState(state, { activeNotes }),
    actions: {
      playNote,
      stopNote,
      setMouseActive,
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

    case 'SET_MOUSE_ACTIVE':
      return {
        ...state,
        mouseActive: action.payload,
      };

    default:
      return state;
  }
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
