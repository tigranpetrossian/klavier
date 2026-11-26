import { tunable } from '@/lib/tuner/tunable';

let gridWidthRuns = 0;

export const HEADLINE = tunable('hydration.headline', 'Server headline');
export const COLUMNS = tunable('hydration.columns', 2);
export const START_COUNT = tunable('hydration.start-count', 1);
export const GRID_WIDTH = countGridWidthRun(COLUMNS * 100);

export function gridWidthRunCount(): number {
  return gridWidthRuns;
}

function countGridWidthRun(width: number): number {
  gridWidthRuns++;
  return width;
}
