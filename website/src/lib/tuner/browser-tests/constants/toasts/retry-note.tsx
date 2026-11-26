import { RETRY_DELAY, RETRY_LABEL } from './awaited-config';

export function RetryNote() {
  return (
    <p data-testid="retry-note">
      {RETRY_LABEL} in {RETRY_DELAY}
    </p>
  );
}
