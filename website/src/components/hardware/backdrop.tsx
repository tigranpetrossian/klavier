import type { ComponentProps } from 'react';
import { classNames } from './class-names';
import './lighting.css';
import './backdrop.css';

function Backdrop({ className, ...props }: ComponentProps<'main'>) {
  return <main {...props} className={classNames('hw-Backdrop', className)} />;
}

export { Backdrop };
