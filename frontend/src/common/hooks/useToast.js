import { useCallback, useState } from 'react'

let nextId = 1

export function useToast() {
    const [toasts, setToasts] = useState([])

    const addToast = useCallback((message, type = 'info', duration = 3500) => {
        const id = nextId++
        setToasts(prev => [...prev, { id, message, type, duration }])
    }, [])

    const removeToast = useCallback((id) => {
        setToasts(prev => prev.filter(t => t.id !== id))
    }, [])

    const success = useCallback((message, duration) => addToast(message, 'success', duration), [addToast])
    const error = useCallback((message, duration) => addToast(message, 'error', duration), [addToast])
    const info = useCallback((message, duration) => addToast(message, 'info', duration), [addToast])

    return { toasts, removeToast, success, error, info }
}
