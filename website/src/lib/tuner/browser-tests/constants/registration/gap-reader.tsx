import { HOT_GAP } from './gap-config';
import { DOUBLE_GAP } from './gap-double';

export function GapPair() {
  return (
    <p data-testid="gap-pair">
      {HOT_GAP}/{DOUBLE_GAP}
    </p>
  );
}
