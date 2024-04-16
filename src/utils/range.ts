/**
 * Create an array of numbers in a specified range.
 *
 * @param {number} start - The starting number (inclusive).
 * @param {number} end - The ending number (exclusive).
 * @return {Array<number>}
 */
export function range(start: number, end: number): Array<number> {
  const ret: Array<number> = [];
  for (let i = start; i < end; i++) {
    ret.push(i);
  }
  return ret;
}
