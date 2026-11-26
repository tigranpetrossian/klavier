import { FIRST_STEP, OTHER_STEPS, TOAST_HEIGHT, TOAST_WIDTH } from './toast-sizes';

export function ToastBox() {
  return (
    <p data-testid="toast-box">
      {TOAST_WIDTH}x{TOAST_HEIGHT} {FIRST_STEP}|{OTHER_STEPS.join('+')}
    </p>
  );
}
