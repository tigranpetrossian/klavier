import { scopePath, type ScopeFrame, type Waveform } from './waveform';

const SCOPE_FRAME: ScopeFrame = { width: 320, height: 100, samples: 240 };
const SCOPE_CYCLES = 2.5;
const SCOPE_HEADROOM = 0.86;

type ScopeDisplayProps = {
  title: string;
  waveform: Waveform;
  amplitude: number;
  echo: number;
  live: boolean;
  readouts: readonly string[];
};

function ScopeDisplay({ title, waveform, amplitude, echo, live, readouts }: ScopeDisplayProps) {
  const trace = scopePath(
    { waveform, amplitude: live ? amplitude * SCOPE_HEADROOM : 0, echo, cycles: SCOPE_CYCLES },
    SCOPE_FRAME
  );
  return (
    <div className="demo-Scope" data-live={live ? '' : undefined}>
      <div className="demo-ScopeRow">
        <span>{title}</span>
        <span className="demo-ScopeDim">48.0 khz</span>
      </div>
      <div className="demo-ScopePlot">
        <svg viewBox={`0 0 ${SCOPE_FRAME.width} ${SCOPE_FRAME.height}`} preserveAspectRatio="none" aria-hidden>
          <path className="demo-ScopeTrace" d={trace} />
        </svg>
      </div>
      <div className="demo-ScopeRow">
        {readouts.map((readout) => (
          <span key={readout} className="demo-ScopeDim">
            {readout}
          </span>
        ))}
      </div>
    </div>
  );
}

export { ScopeDisplay };
