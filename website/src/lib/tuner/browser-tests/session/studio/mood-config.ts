import { tunable } from '@/lib/tuner/tunable';

export const STUDIO_MOOD = tunable<'calm' | 'busy'>('studio.mood', 'calm');
