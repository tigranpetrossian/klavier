const PREFIX = '[tuner]';

const shown = new Set<string>();

export function reportError(message: string, cause?: unknown): void {
  report(console.error, message, cause);
}

export function reportWarning(message: string): void {
  report(console.warn, message, undefined);
}

function report(write: (...data: unknown[]) => void, message: string, cause: unknown): void {
  if (shown.has(message)) return;
  shown.add(message);
  if (cause === undefined) write(`${PREFIX} ${message}`);
  else write(`${PREFIX} ${message}`, cause);
}
