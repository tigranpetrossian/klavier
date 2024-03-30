import { useReducer } from 'react';

type State = {
  activeNotes: Array<number>;
  touched: boolean;
  mouseActive: boolean;
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

export function useKlavierState(initialActiveNotes: Array<number>) {
  const [state, dispatch] = useReducer(reducer, initialActiveNotes, initialize);

  const playNote = (midiNumber: number) => {
    dispatch({ type: 'NOTE_ON', payload: midiNumber });
  };

  const stopNote = (midiNumber: number) => {
    dispatch({ type: 'NOTE_OFF', payload: midiNumber });
  };

  const setMouseActive = (isActive: boolean) => {
    dispatch({ type: 'SET_MOUSE_ACTIVE', payload: isActive });
  };

  return {
    state,
    actions: {
      playNote,
      stopNote,
      setMouseActive,
    },
  };
}

function initialize(initialActiveNotes: Array<number>) {
  return {
    activeNotes: initialActiveNotes,
    touched: false,
    mouseActive: false,
  };
}

function reducer(state: State, action: Action) {
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
