import type { ComponentProps } from 'react';
import { classNames } from './class-names';
import './lighting.css';
import './legend.css';

type LegendTone = 'ink' | 'dim';

type LegendProps = ComponentProps<'span'> & { tone?: LegendTone };

function Legend({ tone = 'ink', className, ...props }: LegendProps) {
  return <span {...props} data-tone={tone} className={classNames('hw-Legend hw-LegendType', className)} />;
}

export { Legend };
