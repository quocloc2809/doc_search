import httpClient from './httpClient'

export async function getDepartments() {
  const response = await httpClient.get('/api/departments')
  return response.data
}
