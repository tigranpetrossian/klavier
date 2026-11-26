import path from 'node:path';

export type TunerServerOptions = {
  root: string;
  sourceDirectory: string;
  exclude: readonly string[];
};

export type TunerOptionsResult = { ok: true; options: TunerServerOptions } | { ok: false; reason: string };

export function readTunerOptions(raw: string | undefined): TunerOptionsResult {
  if (raw === undefined) {
    return unreadable('TUNER_OPTIONS is not set; is withTuner in next.config?');
  }
  const parsed = parseJson(raw);
  if (!isRecord(parsed)) {
    return unreadable('TUNER_OPTIONS is not a JSON object');
  }
  const { root, sourceDirectory, exclude } = parsed;
  if (typeof root !== 'string' || !path.isAbsolute(root)) {
    return unreadable('TUNER_OPTIONS.root is not an absolute path');
  }
  if (typeof sourceDirectory !== 'string') {
    return unreadable('TUNER_OPTIONS.sourceDirectory is not a string');
  }
  if (!isStringArray(exclude)) {
    return unreadable('TUNER_OPTIONS.exclude is not a list of strings');
  }
  return { ok: true, options: { root, sourceDirectory, exclude } };
}

function unreadable(reason: string): TunerOptionsResult {
  return { ok: false, reason };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
