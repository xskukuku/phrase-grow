import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Root element not found');

// Deliberately not using StrictMode: its development double-mount would request
// two paid DeepSeek sentences for the same review card.
createRoot(rootElement).render(<App />);
