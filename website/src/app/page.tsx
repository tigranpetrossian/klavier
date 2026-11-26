import { DemoSynth } from '@/components/demo-synth/demo-synth';
import { Backdrop } from '@/components/hardware/backdrop';

export default function HomePage() {
  return (
    <Backdrop className="demo-Page">
      <DemoSynth />
    </Backdrop>
  );
}
