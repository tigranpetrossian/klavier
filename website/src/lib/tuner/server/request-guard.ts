import { readTunerOptions, type TunerServerOptions } from './tuner-options.ts';

export type GuardResult = { ok: true; options: TunerServerOptions } | { ok: false; status: number; reason: string };

export function guardRequest(request: Request): GuardResult {
  if (!isSameOrigin(request.headers)) {
    return {
      ok: false,
      status: 403,
      reason: 'Only same-origin requests are accepted',
    };
  }
  const options = readTunerOptions(process.env.TUNER_OPTIONS);
  if (!options.ok) return { ok: false, status: 500, reason: options.reason };
  return options;
}

function isSameOrigin(headers: Headers): boolean {
  const origin = headers.get('origin');
  if (origin === null) return headers.get('sec-fetch-site') === 'same-origin';
  const host = headers.get('host');
  return host !== null && URL.parse(origin)?.host === host;
}
