import { classNames } from './class-names';
import './lighting.css';
import './lamp.css';

type LampShape = 'pill' | 'round';

type LampProps = {
  on?: boolean;
  shape?: LampShape;
  className?: string;
};

function Lamp({ on = false, shape = 'pill', className }: LampProps) {
  return (
    <span aria-hidden data-on={on ? '' : undefined} data-shape={shape} className={classNames('hw-Lamp', className)} />
  );
}

export { Lamp };
