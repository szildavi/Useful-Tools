import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles/global.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('The application root element is missing from the page.');
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
