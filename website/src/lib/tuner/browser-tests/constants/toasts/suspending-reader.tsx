import { use } from 'react';
import { TOAST_LIMIT } from './toast-config';

export function SuspendingReader({ text }: { text: Promise<string> }) {
  const limit = TOAST_LIMIT;
  return (
    <span data-testid="suspending-reader">
      {use(text)}:{limit}
    </span>
  );
}
