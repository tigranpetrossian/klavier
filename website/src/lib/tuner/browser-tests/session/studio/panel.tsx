import { CONTENT_WIDTH, PANEL_TONE } from './panel-config';

export function Panel() {
  return (
    <p data-testid="panel">
      {PANEL_TONE} {CONTENT_WIDTH}
    </p>
  );
}
