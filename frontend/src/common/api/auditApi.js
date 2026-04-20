import httpClient from './httpClient'

export async function getAuditLogs(params = {}) {
  const response = await httpClient.get('/api/audit', { params })
  return response.data
}
