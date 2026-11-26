type Waveform = 'sine' | 'triangle' | 'saw' | 'square';

type ScopeShape = { waveform: Waveform; amplitude: number; echo: number; cycles: number };

type ScopeFrame = { width: number; height: number; samples: number };

const ECHO_DELAY_CYCLES = 0.31;
const ECHO_HARMONIC = 3;
const SQUARE_SOFTNESS = 14;

function scopePath(shape: ScopeShape, frame: ScopeFrame): string {
  const middle = frame.height / 2;
  const reach = middle * shape.amplitude;
  return Array.from({ length: frame.samples + 1 }, (_, index) => {
    const progress = index / frame.samples;
    const x = progress * frame.width;
    const y = middle - scopeSample(shape, progress * shape.cycles) * reach;
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join('');
}

function scopeSample(shape: ScopeShape, phase: number): number {
  const dry = waveSample(shape.waveform, phase);
  const wet = Math.sin((phase - ECHO_DELAY_CYCLES) * ECHO_HARMONIC * Math.PI * 2);
  return (dry + wet * shape.echo) / (1 + shape.echo);
}

function waveSample(waveform: Waveform, phase: number): number {
  const cycle = phase - Math.floor(phase);
  if (waveform === 'sine') return Math.sin(cycle * Math.PI * 2);
  if (waveform === 'triangle') return 1 - 4 * Math.abs(cycle - 0.5);
  if (waveform === 'saw') return 2 * cycle - 1;
  return Math.tanh(Math.sin(cycle * Math.PI * 2) * SQUARE_SOFTNESS);
}

export { scopePath };
export type { ScopeFrame, ScopeShape, Waveform };
