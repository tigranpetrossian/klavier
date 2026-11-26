import { createElement } from 'react';
import { renderToString } from 'react-dom/server';
import { expect, test } from 'vitest';
import { useTunables, useTuningSession } from './react';

test('the tuning hooks render on the server with nothing changed and nothing to undo', () => {
  const html = renderToString(createElement(SessionSummary));

  expect(html).toBe('<p>0 changed, undo none, redo none, idle, 0 values</p>');
});

function SessionSummary() {
  const session = useTuningSession();
  const tunables = useTunables();
  return createElement(
    'p',
    null,
    `${session.changedCount} changed, undo ${session.undoIds ?? 'none'}, redo ${session.redoIds ?? 'none'}, ${session.saveState.status}, ${tunables.length} values`
  );
}
