import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';
import { withTuner } from './src/lib/tuner/next.ts';

const TUNER_OPTIONS = { exclude: ['src/dev-tools'] };

function configFor(phase: string): NextConfig {
  return phase === PHASE_DEVELOPMENT_SERVER ? {} : { output: 'export' };
}

export default function nextConfig(phase: string): NextConfig {
  return withTuner(configFor(phase), TUNER_OPTIONS)(phase);
}
