import { count } from '../../support/untransformed';
import { TOAST_GAP, TOAST_LIMIT } from './toast-config';

export function LimitReader() {
  count('render:LimitReader');
  return <p data-testid="limit-reader">{TOAST_LIMIT}</p>;
}

export function GapReader() {
  count('render:GapReader');
  return <p data-testid="gap-reader">{TOAST_GAP}</p>;
}

export function Bystander() {
  count('render:Bystander');
  return <p data-testid="bystander">static</p>;
}

export function GapWhenShown({ shown }: { shown: boolean }) {
  count('render:GapWhenShown');
  return <p data-testid="gap-when-shown">{shown ? TOAST_GAP : 'hidden'}</p>;
}
