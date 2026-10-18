import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { createDefaultRepository } from './app/services';
import './styles/app.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root ausente');
createRoot(root).render(
  <StrictMode>
    <App repo={createDefaultRepository()} />
  </StrictMode>,
);
