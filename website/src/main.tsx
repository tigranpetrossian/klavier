import { Klavier } from 'klavier/react';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Missing #root element in index.html');
}

createRoot(rootElement).render(
  <StrictMode>
    <Klavier computerKeyboard="global" style={{ maxWidth: 960, margin: '48px auto' }} />
  </StrictMode>
);
