import { Suspense, use, useMemo, useState } from 'react';
import { COLUMNS, GRID_WIDTH, HEADLINE, START_COUNT } from './article-config';

export function ArticlePage({ lateSection }: { lateSection: Promise<void> | null }) {
  return (
    <main>
      <h1 data-testid="headline">{HEADLINE}</h1>
      <GridSize />
      <StartCounter />
      <Suspense fallback={<p>loading</p>}>
        <LateSection gate={lateSection} />
      </Suspense>
    </main>
  );
}

function GridSize() {
  const cells = useMemo(() => COLUMNS * COLUMNS, []);
  return (
    <p data-testid="grid" style={{ width: GRID_WIDTH }}>
      {GRID_WIDTH}px wide, {cells} cells
    </p>
  );
}

function StartCounter() {
  const [count] = useState(START_COUNT);
  return <p data-testid="start-count">count {count}</p>;
}

function LateSection({ gate }: { gate: Promise<void> | null }) {
  if (gate) use(gate);
  const [count] = useState(START_COUNT);
  return (
    <p data-testid="late-section">
      {HEADLINE} at {GRID_WIDTH}px, count {count}
    </p>
  );
}
