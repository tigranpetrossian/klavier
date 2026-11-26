import { TOAST_LIMIT } from './toast-config';
import { STACK_SUMMARY } from './toast-summary';

export function ToastStack() {
  return <p data-testid="toast-limit">{TOAST_LIMIT}</p>;
}

export function ToastSummary() {
  return <p data-testid="toast-summary">{STACK_SUMMARY}</p>;
}
