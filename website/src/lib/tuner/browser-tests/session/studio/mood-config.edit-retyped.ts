import { tunable } from '@/lib/tuner/tunable';

export const STUDIO_MOOD = tunable<'quiet' | 'loud'>('studio.mood', 'quiet');
