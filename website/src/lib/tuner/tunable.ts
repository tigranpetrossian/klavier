export type Color = `#${string}` | `rgb(${string})` | `hsl(${string})` | `oklch(${string})`;

export function tunable(id: string, value: number): number;
export function tunable(id: string, value: string): string;
export function tunable(id: string, value: boolean): boolean;
export function tunable<T>(id: string, value: T): T;
export function tunable<T>(_id: string, value: T): T {
  return value;
}
