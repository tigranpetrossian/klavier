import { STUDIO_GAP, STUDIO_TONE, STUDIO_WIDTH } from './studio-config';

export function Studio() {
  return (
    <p data-testid="studio">
      {STUDIO_TONE} {STUDIO_WIDTH} {STUDIO_GAP}
    </p>
  );
}
