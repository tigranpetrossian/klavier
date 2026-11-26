import { useState } from 'react';
import { PlainList } from '../../support/untransformed';
import { STACK_HEIGHT, TOAST_GAP, TOAST_LIMIT } from './toast-config';

export function useSeededCount() {
  const [count, setCount] = useState(TOAST_LIMIT);
  return { count, stack: STACK_HEIGHT, increment: () => setCount((current) => current + 1) };
}

export function useGapLabel() {
  return function renderGapLabel(index: number) {
    return <span key={index}>{TOAST_GAP + index},</span>;
  };
}

export function HookUser() {
  const { count, stack, increment } = useSeededCount();
  return (
    <button data-testid="hook-user" onClick={increment}>
      count={count} stack={stack}
    </button>
  );
}

export function GapList() {
  return <PlainList renderItem={(index) => <span key={index}>{TOAST_GAP + index},</span>} />;
}

export function HookGapList() {
  const label = useGapLabel();
  return <PlainList renderItem={label} />;
}
