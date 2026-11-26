import { useEffect, useMemo, useState } from 'react';
import { count } from '../../support/untransformed';
import { STACK_HEIGHT, TOAST_ACCENT, TOAST_GAP } from './toast-config';

export function ToastEffects() {
  const [clicks, setClicks] = useState(0);
  useEffect(() => {
    count('effect:gap');
    count(`effect:gap=${TOAST_GAP}`);
  }, []);
  const doubled = useMemo(() => {
    count('memo:stack');
    return STACK_HEIGHT * 2;
  }, []);
  return (
    <button data-testid="toast-effects" style={{ color: TOAST_ACCENT }} onClick={() => setClicks(clicks + 1)}>
      doubled={doubled} clicks={clicks}
    </button>
  );
}
