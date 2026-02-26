import { useCallback, useEffect, useState } from 'react'
import { documentsApi } from '../api'

export function useOutgoingDocuments({ autoLoad = true } = {}) {
  const [documents, setDocuments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchOutgoingDocuments = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await documentsApi.getOutgoingDocuments()
      if (result?.success) {
        setDocuments(result.data || [])
      } else {
        setDocuments([])
        setError(result?.message || 'Không thể tải danh sách văn bản đi')
      }
    } catch (apiError) {
      setDocuments([])
      setError(apiError?.response?.data?.message || 'Không thể kết nối máy chủ')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      fetchOutgoingDocuments()
    }
  }, [autoLoad, fetchOutgoingDocuments])

  return {
    documents,
    isLoading,
    error,
    refetch: fetchOutgoingDocuments,
  }
}
