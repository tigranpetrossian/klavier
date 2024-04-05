import { useCallback, useRef } from 'react';

type UseMouseParams = {
  playNote: (midiNumber: number) => void;
  stopNote: (midiNumber: number) => void;
  interactive: boolean;
};

export function useMouse(params: UseMouseParams) {
  const { playNote, stopNote, interactive } = params;
  // keep handleMouseEvents stable to prevent re-rendering of up to 88 keys
  // on each mouse interaction by using ref instead of state
  const isMouseDown = useRef(false);
  const setMouseDown = useCallback((active: boolean) => {
    isMouseDown.current = active;
  }, []);

  const handleGlobalMouseUp = useCallback(() => {
    setMouseDown(false);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [setMouseDown]);

  const handleMouseEvents = useCallback(
    (event: React.MouseEvent) => {
      const dataNumber = event.currentTarget.getAttribute('data-midi-number');
      if (!dataNumber) {
        return;
      }
      const midiNumber = parseInt(dataNumber, 10);

      switch (event.type) {
        case 'mousedown':
          window.addEventListener('mouseup', handleGlobalMouseUp);
          setMouseDown(true);
          playNote(midiNumber);
          break;
        case 'mouseup':
        case 'mouseleave':
          if (isMouseDown.current) {
            stopNote(midiNumber);
          }
          break;
        case 'mouseenter':
          if (isMouseDown.current) {
            playNote(midiNumber);
          }
          break;
      }
    },
    [handleGlobalMouseUp, playNote, stopNote, setMouseDown]
  );

  if (!interactive) {
    return;
  }

  return handleMouseEvents;
}
