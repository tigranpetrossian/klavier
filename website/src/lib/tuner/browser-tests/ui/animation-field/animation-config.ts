import type { Animation } from '@/lib/tuner/animation';
import { tunable } from '@/lib/tuner/tunable';

export const ENTER = tunable<Animation>('ui.enter', { type: 'spring', stiffness: 112, damping: 24, mass: 1, delay: 0 });
export const QUICK = tunable<Animation>('ui.quick', { type: 'time', duration: 100, bounce: 0.3, delay: 0 });
export const BLINK = tunable<Animation>('ui.blink', { type: 'easing', duration: 50, bezier: [0, 0, 1, 1], delay: 0 });
