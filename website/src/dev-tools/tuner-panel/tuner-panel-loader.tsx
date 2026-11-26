'use client';

import { lazy, Suspense } from 'react';

const TunerPanel =
  process.env.NODE_ENV === 'development'
    ? lazy(() => import('./tuner-panel').then((module) => ({ default: module.TunerPanel })))
    : null;

export function TunerPanelLoader() {
  return (
    TunerPanel && (
      <Suspense>
        <TunerPanel />
      </Suspense>
    )
  );
}
