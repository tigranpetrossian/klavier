'use client';

import { useState, type ReactNode } from 'react';
import { Labeled, Module, ModuleTitle } from './module';
import { OutputModule } from './output-module';
import { ScopeDisplay } from './scope-display';
import type { Waveform } from './waveform';
import { Wordmark } from './wordmark';
import { Knob } from '@/components/hardware/knob';
import { Legend } from '@/components/hardware/legend';
import { Lamp } from '@/components/hardware/lamp';
import { Rule } from '@/components/hardware/rule';
import { Screen } from '@/components/hardware/screen';
import { SegmentedControl, type SegmentOption } from '@/components/hardware/segmented-control';
import { Selector, type SelectorOption } from '@/components/hardware/selector';
import { Slider } from '@/components/hardware/slider';
import { Surface } from '@/components/hardware/surface';
import { Toggle } from '@/components/hardware/toggle';
import { Klavier } from '@/components/klavier';
import './demo-synth.css';

type Instrument = 'grand' | 'upright' | 'rhodes' | 'clavinet' | 'organ';
type Octave = 'low' | 'middle' | 'high';
type MacroId = 'a' | 'b' | 'c' | 'd';

const LARGE_KNOB_SIZE = 88;
const SMALL_KNOB_SIZE = 44;
const TUNE_LENGTH = 220;

const INSTRUMENTS: readonly SelectorOption<Instrument>[] = [
  { value: 'grand', label: 'grand piano' },
  { value: 'upright', label: 'upright piano' },
  { value: 'rhodes', label: 'electric piano' },
  { value: 'clavinet', label: 'clavinet' },
  { value: 'organ', label: 'tonewheel organ' },
];

const WAVEFORMS: readonly SegmentOption<Waveform>[] = [
  { value: 'sine', label: 'sine' },
  { value: 'triangle', label: 'tri' },
  { value: 'saw', label: 'saw' },
  { value: 'square', label: 'sqr' },
];

const OCTAVES: readonly SegmentOption<Octave>[] = [
  { value: 'low', label: '−1' },
  { value: 'middle', label: '0' },
  { value: 'high', label: '+1' },
];

const OCTAVE_RANGES: Record<Octave, readonly [number, number]> = {
  low: [24, 72],
  middle: [36, 84],
  high: [48, 96],
};

const MACROS: readonly MacroId[] = ['a', 'b', 'c', 'd'];
const INITIAL_MACROS: Record<MacroId, number> = { a: 0.12, b: 0.2, c: 0.16, d: 0.18 };

function DemoSynth() {
  const [power, setPower] = useState(true);
  const [instrument, setInstrument] = useState<Instrument>('grand');
  const [waveform, setWaveform] = useState<Waveform>('sine');
  const [macros, setMacros] = useState(INITIAL_MACROS);
  const [wet, setWet] = useState(0.34);
  const [dry, setDry] = useState(0.5);
  const [gain, setGain] = useState(0.62);
  const [tune, setTune] = useState(0);
  const [hold, setHold] = useState(false);
  const [mono, setMono] = useState(true);
  const [glide, setGlide] = useState(false);
  const [sustain, setSustain] = useState(false);
  const [octave, setOctave] = useState<Octave>('middle');
  const [heldNotes, setHeldNotes] = useState(0);
  const playing = heldNotes > 0;

  return (
    <Surface className="demo-Synth">
      <header className="demo-Header">
        <div className="demo-Brand">
          <Wordmark className="demo-Wordmark" />
        </div>
        <div className="demo-Status">
          <StatusLight on={power && playing}>midi in</StatusLight>
          <StatusLight on={power}>stereo out</StatusLight>
        </div>
        <Toggle shape="round" aria-label="Power" lamp={false} pressed={power} onPressedChange={setPower}>
          <PowerIcon />
        </Toggle>
      </header>

      <Rule />

      <div className="demo-Modules">
        <Module title="voice" span={3}>
          <Selector aria-label="Instrument" options={INSTRUMENTS} value={instrument} onValueChange={setInstrument} />
          <SegmentedControl aria-label="Waveform" options={WAVEFORMS} value={waveform} onValueChange={setWaveform} />
          <div className="demo-Row" data-spread>
            {MACROS.map((macro) => (
              <Labeled key={macro} label={macro.toUpperCase()}>
                <Knob
                  aria-label={`Custom setting ${macro.toUpperCase()}`}
                  size={SMALL_KNOB_SIZE}
                  value={macros[macro]}
                  defaultValue={INITIAL_MACROS[macro]}
                  onValueChange={(value) => setMacros((current) => ({ ...current, [macro]: value }))}
                />
              </Labeled>
            ))}
          </div>
        </Module>

        <Module title="scope" span={3}>
          <Screen className="demo-ScopeScreen">
            <ScopeDisplay
              title={labelOf(INSTRUMENTS, instrument)}
              waveform={waveform}
              amplitude={gain}
              echo={wet}
              live={power}
              readouts={[`wet ${percent(wet)}`, `dry ${percent(dry)}`, `gain ${percent(gain)}`]}
            />
          </Screen>
          <div className="demo-Row" data-spread>
            <Toggle pressed={hold} onPressedChange={setHold}>
              hold
            </Toggle>
            <Toggle pressed={mono} onPressedChange={setMono}>
              mono
            </Toggle>
            <Toggle pressed={glide} onPressedChange={setGlide}>
              glide
            </Toggle>
          </div>
        </Module>

        <Module title="tone" span={4}>
          <div className="demo-Row" data-spread data-inset>
            <Labeled label="wet" size="large">
              <Knob
                aria-label="Wet"
                size={LARGE_KNOB_SIZE}
                scale="arc"
                value={wet}
                defaultValue={0.34}
                onValueChange={setWet}
              />
            </Labeled>
            <Labeled label="dry" size="large">
              <Knob
                aria-label="Dry"
                size={LARGE_KNOB_SIZE}
                scale="lit-dots"
                value={dry}
                defaultValue={0.5}
                onValueChange={setDry}
              />
            </Labeled>
            <Labeled label="output gain" size="large">
              <Knob
                aria-label="Output gain"
                size={LARGE_KNOB_SIZE}
                scale="dots"
                value={gain}
                defaultValue={0.62}
                onValueChange={setGain}
              />
            </Labeled>
          </div>
          <div className="demo-Row" data-balanced>
            <Legend>tune</Legend>
            <Slider
              aria-label="Tune"
              orientation="horizontal"
              length={TUNE_LENGTH}
              min={-1}
              max={1}
              value={tune}
              onValueChange={setTune}
            />
            <Legend tone="dim">{cents(tune)}</Legend>
          </div>
        </Module>

        <OutputModule gain={gain} sounding={power && playing} />
      </div>

      <Rule />

      <div className="demo-Keys">
        <div className="demo-KeysControls">
          <ModuleTitle>keys</ModuleTitle>
          <SegmentedControl aria-label="Octave" options={OCTAVES} value={octave} onValueChange={setOctave} />
          <div className="demo-Row">
            <Toggle shape="round" aria-label="Sustain" pressed={sustain} onPressedChange={setSustain}>
              <SustainIcon />
            </Toggle>
            <Legend>sustain</Legend>
          </div>
        </div>
        <div className="demo-KeyBay hw-Recess">
          <Klavier
            className="demo-Keyboard"
            computerKeyboard="global"
            range={OCTAVE_RANGES[octave]}
            onNoteOn={() => setHeldNotes((count) => count + 1)}
            onNoteOff={() => setHeldNotes((count) => Math.max(0, count - 1))}
          />
        </div>
      </div>
    </Surface>
  );
}

function StatusLight({ on, children }: { on: boolean; children: ReactNode }) {
  return (
    <span className="demo-StatusItem">
      <Lamp on={on} />
      <Legend>{children}</Legend>
    </span>
  );
}

function PowerIcon() {
  return (
    <span className="demo-PowerIcon" aria-hidden>
      <PowerGlyph />
      <PowerGlyph className="demo-PowerIconLit" />
    </span>
  );
}

function PowerGlyph({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M10 2.04163C10.4142 2.04163 10.75 2.37741 10.75 2.79163V8.33305C10.75 8.74726 10.4142 9.08305 10 9.08305C9.58579 9.08305 9.25 8.74726 9.25 8.33305V2.79163C9.25 2.37741 9.58579 2.04163 10 2.04163ZM6.63582 4.31557C6.88869 4.64364 6.82773 5.11458 6.49967 5.36746C5.13661 6.4181 4.26074 8.06462 4.26074 9.91604C4.26074 13.0856 6.83023 15.6551 9.99983 15.6551C13.1694 15.6551 15.7389 13.0856 15.7389 9.91604C15.7389 8.06462 14.8631 6.4181 13.5 5.36746C13.1719 5.11458 13.111 4.64364 13.3638 4.31557C13.6167 3.9875 14.0877 3.92655 14.4157 4.17942C16.1313 5.50182 17.2389 7.57975 17.2389 9.91604C17.2389 13.914 13.9978 17.1551 9.99983 17.1551C6.0018 17.1551 2.76074 13.914 2.76074 9.91604C2.76074 7.57976 3.86831 5.50182 5.58393 4.17942C5.912 3.92655 6.38294 3.9875 6.63582 4.31557Z"
      />
    </svg>
  );
}

function SustainIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden>
      <path
        d="M1.5 8.5C4 8.5 4 3.5 6 3.5C8 3.5 8 8.5 10.5 8.5"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function labelOf<T extends string>(options: readonly SelectorOption<T>[], value: T): string {
  return options.find((option) => option.value === value)?.label ?? value;
}

function percent(value: number): string {
  return `${Math.round(value * 100)}`;
}

function cents(tune: number): string {
  const rounded = Math.round(tune * 100);
  return `${rounded > 0 ? '+' : ''}${rounded} ct`;
}

export { DemoSynth };
