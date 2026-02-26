import httpClient from './httpClient'

export async function login(payload) {
  const response = await httpClient.post('/api/auth/login', payload)
  return response.data
}

export async function register(payload) {
  const response = await httpClient.post('/api/auth/register', payload)
  return response.data
}

export async function changePassword(payload) {
  const response = await httpClient.post('/api/auth/change-password', payload)
  return response.data
}
