import { useReducer, useState } from 'react';
import { TOAST_GAP, TOAST_LIMIT } from './toast-config';

export function SeededCounter() {
  const [count, setCount] = useState(TOAST_LIMIT);
  return (
    <div>
      <button data-testid="seeded-count" onClick={() => setCount(count + 1)}>
        {count}
      </button>
      <span data-testid="seeded-gap">{TOAST_GAP}</span>
      <ChildCounter />
    </div>
  );
}

function ChildCounter() {
  const [clicks, setClicks] = useState(0);
  return (
    <button data-testid="child-count" onClick={() => setClicks(clicks + 1)}>
      {clicks}
    </button>
  );
}

export function SiblingCounter() {
  const [clicks, setClicks] = useState(0);
  return (
    <button data-testid="sibling-count" onClick={() => setClicks(clicks + 1)}>
      {TOAST_LIMIT}:{clicks}
    </button>
  );
}

export function LazySeeded() {
  const [scaled] = useState(() => TOAST_GAP * 10);
  const [count, increment] = useReducer(
    (current: number) => current + 1,
    TOAST_LIMIT,
    (limit: number) => limit + 5
  );
  return (
    <button data-testid="lazy-seeded" onClick={() => increment()}>
      {scaled}/{count}
    </button>
  );
}
