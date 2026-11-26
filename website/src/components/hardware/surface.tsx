import type { ComponentProps } from 'react';
import { classNames } from './class-names';
import './lighting.css';
import './surface.css';

function Surface({ className, ...props }: ComponentProps<'div'>) {
  return <div {...props} className={classNames('hw-Surface', className)} />;
}

export { Surface };
