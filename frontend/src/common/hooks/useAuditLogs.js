import { useCallback, useEffect, useState } from 'react'
import * as auditApi from '../api/auditApi'

export function useAuditLogs({ limit = 200, date } = {}) {
  const [auditLogs, setAuditLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState({ date: null, availableDates: [] })

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const params = { limit }
      if (date) {
        params.date = date
      }
      const res = await auditApi.getAuditLogs(params)
      setAuditLogs(res.data || [])
      setMeta(res.meta || { date: null, availableDates: [] })
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải audit log')
    } finally {
      setIsLoading(false)
    }
  }, [date, limit])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  return { auditLogs, isLoading, error, meta, refetch: fetchAuditLogs }
}
