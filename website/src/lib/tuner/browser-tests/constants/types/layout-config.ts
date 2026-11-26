import { tunable, type Color } from '@/lib/tuner/tunable';

type ToastPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
type Offset = { x: number; y: number };

export const TOAST_POSITION = tunable<ToastPosition>('layout.position', 'bottom-right');
export const CARD_ACCENT = tunable<Color>('layout.accent', '#0d99ff');
export const CARD_OFFSET = tunable<Offset>('layout.offset', { x: 0, y: 8 });
export const STEPS = tunable<readonly number[]>('layout.steps', [4, 8]);
export const SHADOW = tunable<[number, string]>('layout.shadow', [2, 'soft']);
export const MAX_WIDTH = tunable<number | null>('layout.max-width', null);
export const DENSITY = tunable<1 | 2 | 'auto'>('layout.density', 'auto');
export const TITLE = tunable('layout.title', 'Notifications');
export const SIZE = tunable('layout.size', { width: 320, height: 64 });
export const ANIMATED = tunable('layout.animated', true);

type Badge = { kind: 'dot'; size: number } | { kind: 'count'; max: number };

export const BADGE = tunable<Badge>('layout.badge', { kind: 'dot', size: 6 });
