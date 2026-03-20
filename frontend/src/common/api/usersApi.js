import httpClient from './httpClient'

export async function getUsers() {
  const response = await httpClient.get('/api/auth/admin/users')
  return response.data
}

export async function createUser(payload) {
  const response = await httpClient.post('/api/auth/admin/users', payload)
  return response.data
}

export async function updateUser(userId, payload) {
  const response = await httpClient.put(`/api/auth/admin/users/${userId}`, payload)
  return response.data
}

export async function deleteUser(userId) {
  const response = await httpClient.delete(`/api/auth/admin/users/${userId}`)
  return response.data
}
