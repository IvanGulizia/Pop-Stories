import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { CursorProvider } from './context/CursorContext';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CursorProvider>
      <App />
    </CursorProvider>
  </StrictMode>,
);
