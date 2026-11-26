import { useState } from 'react';
import { TOAST_GAP, TOAST_LIMIT } from './toast-config';

export default ({ label }: { label: string }) => {
  const [count] = useState(TOAST_LIMIT);
  return (
    <p data-testid="default-arrow-form">
      {label}:{count}:{TOAST_GAP}
    </p>
  );
};
