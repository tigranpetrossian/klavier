import { useState } from 'react';
import { TOAST_GAP, TOAST_LIMIT } from './toast-config';

export default function DefaultFunctionForm({ label }: { label: string }) {
  const [count] = useState(TOAST_LIMIT);
  return (
    <p data-testid="default-function-form">
      {label}:{count}:{TOAST_GAP}
    </p>
  );
}
