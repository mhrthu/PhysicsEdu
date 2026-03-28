import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import '@/catalog/index.ts';
import { AppLayout } from '@/layout/AppLayout.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLayout />
  </StrictMode>,
);
