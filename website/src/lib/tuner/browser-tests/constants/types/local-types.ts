import { tunable } from '@/lib/tuner/tunable';

interface Toast {
  tone: 'info' | 'warn';
  count: number;
}

interface LabeledToast extends Toast {
  label: string;
}

interface Point {
  x: number;
  y: number;
}

interface Dot {
  kind: 'dot';
  size: number;
}

interface Ring {
  kind: 'ring';
  width: number;
}

type Marker = Dot | Ring;
type Corner = 'top-left' | 'top-right';

export const TOAST = tunable<Toast>('types.interface', { tone: 'info', count: 1 });
export const LABELED_TOAST = tunable<LabeledToast>('types.extended-interface', {
  tone: 'info',
  count: 1,
  label: 'New',
});
export const PATH = tunable<readonly Point[]>('types.readonly-points', []);
export const CORNERS = tunable<Array<Corner>>('types.corner-array', ['top-left']);
export const LEVELS = tunable<ReadonlyArray<1 | 2>>('types.level-array', [1]);
export const ANCHOR = tunable<readonly [Corner, number]>('types.anchor-tuple', ['top-left', 0]);
export const SHADOW = tunable<{ offset: Point; blur: { radius: number; tone: 'soft' | 'hard' } }>(
  'types.nested-object',
  {
    offset: { x: 0, y: 2 },
    blur: { radius: 4, tone: 'soft' },
  }
);
export const MARKER = tunable<Marker>('types.marker', { kind: 'dot', size: 6 });
export const ORIGIN = tunable<Point | null>('types.nullable-point', null);
