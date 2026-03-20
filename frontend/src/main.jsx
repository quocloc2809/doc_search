import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './common/ui/common.css';
import App from './App.jsx';
import './App.css';
import { TooltipProvider } from '@/components/ui/tooltip';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            <TooltipProvider>
                <App />
            </TooltipProvider>
        </BrowserRouter>
    </StrictMode>,
);
