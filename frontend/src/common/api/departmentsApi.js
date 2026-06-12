import httpClient from './httpClient'

export async function getDepartments() {
  const response = await httpClient.get('/api/departments')
  return response.data
}

export async function getPortals() {
  const response = await httpClient.get('/api/departments/portals')
  return response.data
}
