import { useCallback, useEffect, useState } from 'react'
import * as usersApi from '../api/usersApi'

export function useUsers() {
  const [users, setUsers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await usersApi.getUsers()
      setUsers(res.data || [])
    } catch (err) {
      setError(err?.response?.data?.message || 'Không thể tải danh sách tài khoản')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  const createUser = useCallback(async (payload) => {
    const res = await usersApi.createUser(payload)
    await fetchUsers()
    return res
  }, [fetchUsers])

  const updateUser = useCallback(async (userId, payload) => {
    const res = await usersApi.updateUser(userId, payload)
    await fetchUsers()
    return res
  }, [fetchUsers])

  const deleteUser = useCallback(async (userId) => {
    const res = await usersApi.deleteUser(userId)
    await fetchUsers()
    return res
  }, [fetchUsers])

  return { users, isLoading, error, createUser, updateUser, deleteUser, refetch: fetchUsers }
}
