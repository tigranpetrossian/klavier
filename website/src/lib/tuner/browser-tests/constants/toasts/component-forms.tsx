import { memo, useEffect, useRef, useState, type Ref } from 'react';
import { count } from '../../support/untransformed';
import { TOAST_GAP, TOAST_LIMIT } from './toast-config';

export const ArrowForm = ({ label }: { label: string }) => {
  const [count] = useState(TOAST_LIMIT);
  return (
    <p data-testid="arrow-form">
      {label}:{count}:{TOAST_GAP}
    </p>
  );
};

export const MemoForm = memo(function MemoForm({ label }: { label: string }) {
  const [count] = useState(TOAST_LIMIT);
  return (
    <p data-testid="memo-form">
      {label}:{count}:{TOAST_GAP}
    </p>
  );
});

export const MemoArrowForm = memo(({ label }: { label: string }) => (
  <p data-testid="memo-arrow-form">
    {label}:{TOAST_LIMIT}:{TOAST_GAP}
  </p>
));
MemoArrowForm.displayName = 'MemoArrowForm';

export function RefSeeded() {
  const seed = useRef(TOAST_GAP);
  const [clicks, setClicks] = useState(0);
  useEffect(() => count(`ref-seeded:${seed.current}`), []);
  return (
    <button data-testid="ref-seeded" onClick={() => setClicks(clicks + 1)}>
      {clicks}
    </button>
  );
}

export function RefTarget({ ref }: { ref: Ref<HTMLButtonElement> }) {
  return (
    <button data-testid="ref-target" ref={ref}>
      {TOAST_LIMIT}
    </button>
  );
}
