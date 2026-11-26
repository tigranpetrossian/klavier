import { tunable } from '@/lib/tuner/tunable';

export const HOT_MODE = tunable<'calm' | 'busy'>('hot.mode', 'calm');
