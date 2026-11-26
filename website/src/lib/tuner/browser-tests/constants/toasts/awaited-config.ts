import { tunable } from '@/lib/tuner/tunable';

export const RETRY_DELAY = tunable('toasts.retry-delay', 100);
export const RETRY_LABEL = await Promise.resolve('retry');
