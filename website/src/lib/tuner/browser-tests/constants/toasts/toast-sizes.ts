import { tunable } from '@/lib/tuner/tunable';

export const TOAST_SIZE = tunable('toasts.size', { width: 320, height: 64 });
export const { width: TOAST_WIDTH, height: TOAST_HEIGHT } = TOAST_SIZE;
export const [FIRST_STEP, ...OTHER_STEPS] = tunable<number[]>('toasts.steps', [4, 8, 12]);
