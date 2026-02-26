import { useCallback, useEffect, useMemo, useState } from 'react'
import { documentsApi } from '../api'

export function useIncomingDocuments(initialParams = {}, { autoLoad = true } = {}) {
  const [documents, setDocuments] = useState([])
  const [stats, setStats] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [error, setError] = useState('')
  const [params, setParams] = useState(initialParams)

  const stableParams = useMemo(() => params || {}, [params])

  const fetchIncomingDocuments = useCallback(async (overrideParams) => {
    const requestParams = overrideParams || stableParams

    setIsLoading(true)
    setError('')

    try {
      const result = await documentsApi.getIncomingDocuments(requestParams)
      if (result?.success) {
        setDocuments(result.data || [])
        setStats(result.stats || null)
      } else {
        setDocuments([])
        setStats(null)
        setError(result?.message || 'Không thể tải danh sách văn bản đến')
      }
    } catch (apiError) {
      setDocuments([])
      setStats(null)
      setError(apiError?.response?.data?.message || 'Không thể kết nối máy chủ')
    } finally {
      setIsLoading(false)
    }
  }, [stableParams])

  const updateDocument = useCallback(async (documentId, payload) => {
    setIsUpdating(true)
    setError('')

    try {
      const result = await documentsApi.updateIncomingDocument(documentId, payload)
      if (!result?.success) {
        throw new Error(result?.message || 'Cập nhật văn bản thất bại')
      }

      await fetchIncomingDocuments()
      return result
    } catch (apiError) {
      const message = apiError?.response?.data?.message || apiError?.message || 'Không thể cập nhật văn bản'
      setError(message)
      throw apiError
    } finally {
      setIsUpdating(false)
    }
  }, [fetchIncomingDocuments])

  useEffect(() => {
    if (autoLoad) {
      fetchIncomingDocuments()
    }
  }, [autoLoad, fetchIncomingDocuments])

  return {
    documents,
    stats,
    isLoading,
    isUpdating,
    error,
    params: stableParams,
    setParams,
    refetch: fetchIncomingDocuments,
    updateDocument,
  }
}
