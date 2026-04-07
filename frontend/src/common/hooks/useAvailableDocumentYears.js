import { useCallback, useEffect, useState } from 'react'
import { documentsApi } from '../api'

export function useAvailableDocumentYears({ autoLoad = true } = {}) {
  const [years, setYears] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchYears = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await documentsApi.getAvailableDocumentYears()
      if (result?.success) {
        setYears(result.data || [])
      } else {
        setYears([])
        setError(result?.message || 'Không thể tải danh sách năm')
      }
    } catch (apiError) {
      setYears([])
      setError(apiError?.response?.data?.message || 'Không thể kết nối máy chủ')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      fetchYears()
    }
  }, [autoLoad, fetchYears])

  return {
    years,
    isLoading,
    error,
    refetch: fetchYears,
  }
}
