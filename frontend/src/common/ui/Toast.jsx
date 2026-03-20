import { useEffect, useRef } from 'react'

const ICONS = {
    success: (
        <svg width='18' height='18' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='#22c55e' />
            <path d='M6 10l3 3 5-5' stroke='#fff' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
        </svg>
    ),
    error: (
        <svg width='18' height='18' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='#ef4444' />
            <path d='M7 7l6 6M13 7l-6 6' stroke='#fff' strokeWidth='1.8' strokeLinecap='round' />
        </svg>
    ),
    info: (
        <svg width='18' height='18' viewBox='0 0 20 20' fill='none'>
            <circle cx='10' cy='10' r='10' fill='#3b82f6' />
            <path d='M10 9v5' stroke='#fff' strokeWidth='1.8' strokeLinecap='round' />
            <circle cx='10' cy='6.5' r='1' fill='#fff' />
        </svg>
    ),
}

export default function Toast({ toasts = [], onRemove }) {
    return (
        <div className='toast-container'>
            {toasts.map(toast => (
                <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
            ))}
        </div>
    )
}

function ToastItem({ toast, onRemove }) {
    const timerRef = useRef(null)

    useEffect(() => {
        timerRef.current = setTimeout(() => {
            onRemove(toast.id)
        }, toast.duration ?? 3500)

        return () => clearTimeout(timerRef.current)
    }, [toast.id, toast.duration, onRemove])

    return (
        <div className={`toast toast-${toast.type ?? 'info'}`}>
            <span className='toast-icon'>{ICONS[toast.type ?? 'info']}</span>
            <span className='toast-message'>{toast.message}</span>
            <button className='toast-close' onClick={() => onRemove(toast.id)} aria-label='Đóng'>×</button>
        </div>
    )
}
