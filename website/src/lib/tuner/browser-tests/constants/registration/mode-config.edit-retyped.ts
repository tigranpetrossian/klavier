import { tunable } from '@/lib/tuner/tunable';

export const HOT_MODE = tunable<'quiet' | 'loud'>('hot.mode', 'quiet');
