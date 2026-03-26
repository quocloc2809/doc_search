import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import nprogress from 'nprogress';

export default function WatchRoute() {
    const location = useLocation();

    useEffect(() => {
        nprogress.start();
        const timer = setTimeout(() => {
            nprogress.done();
        }, 1000);

        return () => {
            clearTimeout(timer);
            nprogress.done();
        };
    }, [location.pathname]);

    return null;
}
