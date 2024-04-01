import { useCallback } from 'react';

type UseMouseParams = {
  setMouseActive: (active: boolean) => void;
  mouseActive: boolean;
  playNote: (midiNumber: number) => void;
  stopNote: (midiNumber: number) => void;
};

export function useMouse(params: UseMouseParams) {
  const { mouseActive, setMouseActive, playNote, stopNote } = params;
  const handleGlobalMouseUp = useCallback(() => {
    setMouseActive(false);
    window.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [setMouseActive]);

  const handleMouseEvents = useCallback(
    (event: React.MouseEvent) => {
      const dataNumber = event.currentTarget.getAttribute('data-number');
      if (!dataNumber) {
        return;
      }
      const midiNumber = parseInt(dataNumber, 10);

      switch (event.type) {
        case 'mousedown':
          window.addEventListener('mouseup', handleGlobalMouseUp);
          setMouseActive(true);
          playNote(midiNumber);
          break;
        case 'mouseup':
        case 'mouseleave':
          if (mouseActive) {
            stopNote(midiNumber);
          }
          break;
        case 'mouseenter':
          if (mouseActive) {
            playNote(midiNumber);
          }
          break;
      }
    },
    [handleGlobalMouseUp, playNote, stopNote, setMouseActive, mouseActive]
  );

  return {
    handleMouseEvents,
  };
}
