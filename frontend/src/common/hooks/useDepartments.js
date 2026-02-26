import { useCallback, useEffect, useState } from 'react'
import { departmentsApi } from '../api'

export function useDepartments({ autoLoad = true } = {}) {
  const [departments, setDepartments] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const fetchDepartments = useCallback(async () => {
    setIsLoading(true)
    setError('')

    try {
      const result = await departmentsApi.getDepartments()
      if (result?.success) {
        setDepartments(result.data || [])
      } else {
        setDepartments([])
        setError(result?.message || 'Không thể tải danh sách đơn vị')
      }
    } catch (apiError) {
      setDepartments([])
      setError(apiError?.response?.data?.message || 'Không thể kết nối máy chủ')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (autoLoad) {
      fetchDepartments()
    }
  }, [autoLoad, fetchDepartments])

  return {
    departments,
    isLoading,
    error,
    refetch: fetchDepartments,
  }
}
