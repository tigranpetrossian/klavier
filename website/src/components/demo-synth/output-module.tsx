'use client';

import { useState } from 'react';
import { Labeled, Module } from './module';
import { useSimulatedLevels } from './use-simulated-levels';
import { Meter } from '@/components/hardware/meter';
import { Slider } from '@/components/hardware/slider';

const FADER_LENGTH = 176;

type OutputModuleProps = { gain: number; sounding: boolean };

function OutputModule({ gain, sounding }: OutputModuleProps) {
  const [send, setSend] = useState(0.42);
  const [main, setMain] = useState(0.72);
  const levels = useSimulatedLevels({ gain: gain * main, active: sounding });

  return (
    <Module title="output" span={2}>
      <div className="demo-Row" data-spread>
        <Labeled label="send">
          <Slider aria-label="Send" length={FADER_LENGTH} fill value={send} onValueChange={setSend} />
        </Labeled>
        <Labeled label="main">
          <Slider
            aria-label="Main"
            length={FADER_LENGTH}
            fill
            meter={Math.max(...levels)}
            value={main}
            onValueChange={setMain}
          />
        </Labeled>
        <Labeled label="L R">
          <Meter aria-label="Output level" levels={levels} className="demo-OutputMeter" />
        </Labeled>
      </div>
    </Module>
  );
}

export { OutputModule };
