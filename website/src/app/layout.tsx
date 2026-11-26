import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { TunerPanelLoader } from '@/dev-tools/tuner-panel/tuner-panel-loader';

export const metadata: Metadata = {
  title: 'Klavier',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        {children}
        <TunerPanelLoader />
      </body>
    </html>
  );
}
