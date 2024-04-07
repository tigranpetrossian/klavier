import { useCallback, useReducer } from 'react';

type MidiNumber = number;

type State = {
  [id: Touch['identifier']]: MidiNumber;
};

type Action =
  | {
      type: 'ADD_TOUCH_POINT';
      payload: {
        id: Touch['identifier'];
        midiNumber: number;
      };
    }
  | {
      type: 'REMOVE_TOUCH_POINT';
      payload: {
        id: Touch['identifier'];
      };
    }
  | {
      type: 'CHANGE_TOUCH_POINT';
      payload: {
        id: Touch['identifier'];
        midiNumber: number;
      };
    };

function useActiveTouchPoints() {
  const [state, dispatch] = useReducer(reducer, {});

  const upsertTouchPoint = useCallback(
    (id: Touch['identifier'], midiNumber: number) => {
      dispatch({ type: 'ADD_TOUCH_POINT', payload: { id, midiNumber } });
    },
    [dispatch]
  );

  const removeTouchPoint = useCallback(
    (id: Touch['identifier']) => {
      dispatch({ type: 'REMOVE_TOUCH_POINT', payload: { id } });
    },
    [dispatch]
  );

  return {
    activeTouchPoints: state,
    upsertTouchPoint,
    removeTouchPoint,
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD_TOUCH_POINT': {
      return {
        ...state,
        [action.payload.id]: action.payload.midiNumber,
      };
    }
    case 'REMOVE_TOUCH_POINT': {
      const newState = { ...state };
      delete newState[action.payload.id];
      return newState;
    }
    case 'CHANGE_TOUCH_POINT': {
      return {
        ...state,
        [action.payload.id]: action.payload.midiNumber,
      };
    }
    default:
      return state;
  }
}

export { useActiveTouchPoints };
