import { tunable, type Color } from '@/lib/tuner/tunable';

export const TOAST_LIMIT = tunable('toasts.limit', 3);
export const TOAST_GAP = tunable('toasts.gap', 8);
export const TOAST_ACCENT = tunable<Color>('toasts.accent', '#0d99ff');
export const STACK_HEIGHT = TOAST_LIMIT * 44 - TOAST_GAP;
