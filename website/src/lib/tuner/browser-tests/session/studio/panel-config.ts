import { count } from '../../support/untransformed';
import { tunable } from '@/lib/tuner/tunable';

export const PANEL_WIDTH = tunable('panel.width', 320);
export const PANEL_GUTTER = tunable('panel.gutter', 16);
export const PANEL_TONE = tunable<'light' | 'dark'>('panel.tone', 'light');
export const CONTENT_WIDTH = measure(PANEL_WIDTH - 2 * PANEL_GUTTER);

function measure(width: number): number {
  count('CONTENT_WIDTH');
  return width;
}
