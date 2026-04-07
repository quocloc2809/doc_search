import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { documentsApi } from '../api'

export function useOutgoingDocuments(initialParams = {}, { autoLoad = true } = {}) {
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [params, setParams] = useState(initialParams)
  const latestRequestRef = useRef(0)

  const stableParams = useMemo(() => params || {}, [params])

  const fetchOutgoingDocuments = useCallback(async (overrideParams) => {
    const requestParams = overrideParams || stableParams
    const requestId = ++latestRequestRef.current

    setIsLoading(true)
    setError('')

    try {
      const result = await documentsApi.getOutgoingDocuments(requestParams)

      if (requestId !== latestRequestRef.current) {
        return
      }

      if (result?.success) {
        setDocuments(result.data || [])
      } else {
        setDocuments([])
        setError(result?.message || 'Không thể tải danh sách văn bản đi')
      }
    } catch (apiError) {
      if (requestId !== latestRequestRef.current) {
        return
      }
      setDocuments([])
      setError(apiError?.response?.data?.message || 'Không thể kết nối máy chủ')
    } finally {
      if (requestId === latestRequestRef.current) {
        setIsLoading(false)
      }
    }
  }, [stableParams])

  useEffect(() => {
    if (autoLoad) {
      fetchOutgoingDocuments()
    }
  }, [autoLoad, fetchOutgoingDocuments])

  return {
    documents,
    isLoading,
    error,
    params: stableParams,
    setParams,
    refetch: fetchOutgoingDocuments,
  }
}
