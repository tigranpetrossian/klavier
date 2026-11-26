import { tunable } from '@/lib/tuner/tunable';

export function InlineRadius() {
  const radius = tunable('inline.radius', 4);
  return <p data-testid="inline-radius">{radius}</p>;
}
