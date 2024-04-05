export function range(start: number, end: number): Array<number> {
  const ret: Array<number> = [];
  for (let i = start; i < end; i++) {
    ret.push(i);
  }
  return ret;
}
