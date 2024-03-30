import { useReducer } from 'react';

type State = {
  activeNotes: Array<number>;
  touched: boolean;
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

export function useKlavierState(initialActiveNotes: Array<number>) {
  const [state, dispatch] = useReducer(reducer, {
    activeNotes: initialActiveNotes,
    touched: false,
  });

  const playNote = (midiNumber: number) => {
    dispatch({ type: 'NOTE_ON', payload: midiNumber });
  };

  const stopNote = (midiNumber: number) => {
    dispatch({ type: 'NOTE_OFF', payload: midiNumber });
  };

  return {
    state,
    actions: {
      playNote,
      stopNote,
    },
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
    default:
      return state;
  }
}
