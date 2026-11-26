import type { Metadata } from 'next';
import { Sora } from 'next/font/google';
import type { ReactNode } from 'react';
import { TunerPanelLoader } from '@/dev-tools/tuner-panel/tuner-panel-loader';
import './global.css';

const sora = Sora({ subsets: ['latin'], variable: '--font-sora' });

export const metadata: Metadata = {
  title: 'Klavier',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={sora.variable} suppressHydrationWarning>
      <body>
        {children}
        <TunerPanelLoader />
      </body>
    </html>
  );
}
