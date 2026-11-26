import type { Paint, Side, Swatch } from './barrel';
import type { Badge, Corner } from './shapes';
import type * as Shapes from './shapes';
import { type Placement, type shades } from '@/lib/tuner/browser-tests/constants/types/barrel';
import { tunable } from '@/lib/tuner/tunable';

export const BADGE = tunable<Badge>('imported.badge', { tone: 'info', count: 1 });
export const SWATCH = tunable<Swatch>('imported.swatch', { name: 'Ink', color: '#000' });
export const CORNER = tunable<Corner>('imported.corner', 'top-left');
export const PLACEMENT = tunable<Placement>('imported.placement', 'top-left');
export const SIDE = tunable<Side>('imported.side', 'top-left');
export const NAMESPACED_CORNER = tunable<Shapes.Corner>('imported.namespaced-corner', 'top-left');
export const PAINT = tunable<Paint>('imported.paint', 'rgb(0 0 0)');
export const SHADE = tunable<shades.Shade>('imported.shade', 'hsl(0 0% 0%)');
