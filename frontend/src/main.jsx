import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './common/ui/common.css';
import App from './App.jsx';
import './App.css';
import 'nprogress/nprogress.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import WatchRoute from '@/common/routing/WatchRoute';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            {/* <WatchRoute /> */}
            <TooltipProvider>
                <App />
            </TooltipProvider>
        </BrowserRouter>
    </StrictMode>,
);
