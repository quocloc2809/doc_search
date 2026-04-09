import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './index.css';
import './common/ui/common.css';
import App from './App.jsx';
import './App.css';
import 'nprogress/nprogress.css';
import '@react-pdf-viewer/core/lib/styles/index.css';
import '@react-pdf-viewer/default-layout/lib/styles/index.css';
import { TooltipProvider } from '@/components/ui/tooltip';
import WatchRoute from '@/common/routing/WatchRoute';
import { Toaster } from '@/components/ui/sonner';

createRoot(document.getElementById('root')).render(
    <StrictMode>
        <BrowserRouter>
            {/* <WatchRoute /> */}
            <TooltipProvider>
                <App />
                <Toaster position='top-right' />
            </TooltipProvider>
        </BrowserRouter>
    </StrictMode>,
);
