import { useCallback, useEffect, useState } from 'react'
import * as auditApi from '../api/auditApi'

export function useAuditLogs({ limit = 200 } = {}) {
  const [auditLogs, setAuditLogs] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [meta, setMeta] = useState({ date: null })

  const fetchAuditLogs = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await auditApi.getAuditLogs({ limit })
      setAuditLogs(res.data || [])
      setMeta(res.meta || { date: null })
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải audit log')
    } finally {
      setIsLoading(false)
    }
  }, [limit])

  useEffect(() => {
    fetchAuditLogs()
  }, [fetchAuditLogs])

  return { auditLogs, isLoading, error, meta, refetch: fetchAuditLogs }
}
