import { useCallback, useRef } from 'react';

type UseMouseProps = {
  enabled: boolean;
  pressKey: (midiNumber: number) => void;
  releaseKey: (midiNumber: number) => void;
};

export function useMouse(props: UseMouseProps) {
  const { enabled, pressKey, releaseKey } = props;
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
      if (!enabled) {
        return;
      }

      const dataNumber = event.currentTarget.getAttribute('data-midi-number');
      if (!dataNumber) {
        return;
      }
      const midiNumber = parseInt(dataNumber, 10);

      switch (event.type) {
        case 'mousedown':
          window.addEventListener('mouseup', handleGlobalMouseUp);
          setMouseDown(true);
          pressKey(midiNumber);
          break;
        case 'mouseup':
        case 'mouseleave':
          if (isMouseDown.current) {
            releaseKey(midiNumber);
          }
          break;
        case 'mouseenter':
          if (isMouseDown.current) {
            pressKey(midiNumber);
          }
          break;
      }
    },
    [enabled, handleGlobalMouseUp, pressKey, releaseKey, setMouseDown]
  );

  return handleMouseEvents;
}
