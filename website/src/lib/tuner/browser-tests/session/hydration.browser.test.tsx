import { StrictMode, type ReactNode } from 'react';
import { hydrateRoot, type Root } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { clearTuning, ROOTS } from '../support/harness';
import { gridWidthRunCount } from './hydration/article-config';
import { ArticlePage } from './hydration/article-page';
import { createMemoryStorage, useTuningSession, type TuningStorage } from '@/lib/tuner/react';

const hydrated: { root: Root; container: HTMLElement }[] = [];

beforeEach(clearTuning);

afterEach(() => {
  for (const { root, container } of hydrated.splice(0)) {
    root.unmount();
    container.remove();
  }
  vi.restoreAllMocks();
});

describe.each(ROOTS)('in %s', (_, Wrapper) => {
  test('a page that hydrates after the session restored overrides keeps the server HTML, then shows the overrides without rerunning top-level constants', async () => {
    const consoleErrors = vi.spyOn(console, 'error');
    const recoverableErrors: unknown[] = [];
    const storage = createMemoryStorage();
    storage.writeOverrides({
      'hydration.headline': 'Restored headline',
      'hydration.columns': 3,
      'hydration.start-count': 5,
    });
    const pageHtml = renderToString(<ArticlePage lateSection={null} />);
    const panelHtml = renderToString(<SessionPanel storage={storage} />);
    const gridWidthRunsBefore = gridWidthRunCount();

    const panel = hydrate(
      panelHtml,
      <Wrapper>
        <SessionPanel storage={storage} />
      </Wrapper>,
      recoverableErrors
    );
    await expect.element(panel.getByTestId('session-panel')).toHaveTextContent('3 changed');
    const lateSection = Promise.withResolvers<void>();
    const article = hydrate(
      pageHtml,
      <Wrapper>
        <ArticlePage lateSection={lateSection.promise} />
      </Wrapper>,
      recoverableErrors
    );
    const serverHeadline = article.getByTestId('headline').element();

    await expect.element(article.getByTestId('headline')).toHaveTextContent('Restored headline');
    await expect.element(article.getByTestId('grid')).toHaveTextContent('300px wide, 9 cells');
    await expect.element(article.getByTestId('start-count')).toHaveTextContent('count 5');
    lateSection.resolve();
    await expect.element(article.getByTestId('late-section')).toHaveTextContent('Restored headline at 300px, count 5');
    expect([recoverableErrors, consoleErrors.mock.calls, serverHeadline.isConnected]).toEqual([[], [], true]);
    expect(gridWidthRunCount() - gridWidthRunsBefore).toBe(1);
  });
});

test('a module evaluated after the session started hydrates with the defaults the server rendered, then shows its override', async () => {
  const consoleErrors = vi.spyOn(console, 'error');
  const recoverableErrors: unknown[] = [];
  const storage = createMemoryStorage();
  storage.writeOverrides({ 'hydration.late-note': 'Restored note', 'hydration.columns': 3 });
  const serverHtml = renderToString(
    <p data-testid="late-note">
      {'Late note'} ({9})
    </p>
  );
  const panel = hydrate(
    renderToString(<SessionPanel storage={storage} />),
    <SessionPanel storage={storage} />,
    recoverableErrors
  );
  await expect.element(panel.getByTestId('session-panel')).toHaveTextContent('1 changed');

  const { LateNote } = await import('./hydration/late-note');
  const note = hydrate(
    serverHtml,
    <StrictMode>
      <LateNote />
    </StrictMode>,
    recoverableErrors
  );

  await expect.element(note.getByTestId('late-note')).toHaveTextContent('Restored note (13)');
  expect([recoverableErrors, consoleErrors.mock.calls]).toEqual([[], []]);
});

function SessionPanel({ storage }: { storage: TuningStorage }) {
  const session = useTuningSession({ storage });
  return <p data-testid="session-panel">{session.changedCount} changed</p>;
}

function hydrate(html: string, ui: ReactNode, recoverableErrors: unknown[]) {
  const container = document.createElement('div');
  container.dataset.testid = `hydrated-root-${hydrated.length}`;
  container.innerHTML = html;
  document.body.append(container);
  const root = hydrateRoot(container, ui, { onRecoverableError: (error) => recoverableErrors.push(error) });
  hydrated.push({ root, container });
  return page.getByTestId(container.dataset.testid);
}
