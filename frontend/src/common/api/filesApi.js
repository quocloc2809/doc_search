import httpClient from './httpClient'

function extractFileNameFromContentDisposition(contentDispositionHeader) {
  if (!contentDispositionHeader) {
    return 'downloaded-file'
  }

  const matched = contentDispositionHeader.match(/filename="?([^"]+)"?/i)
  if (!matched || !matched[1]) {
    return 'downloaded-file'
  }

  try {
    return decodeURIComponent(matched[1])
  } catch {
    return matched[1]
  }
}

async function downloadFileByPath(path, { params } = {}) {
  const response = await httpClient.get(path, { responseType: 'blob', params })

  return {
    blob: response.data,
    fileName: extractFileNameFromContentDisposition(response.headers['content-disposition']),
    contentType: response.headers['content-type'] || response.data?.type,
  }
}

export async function downloadIncomingFile(documentId, { db, year } = {}) {
  const params = {}
  if (db) params.db = db
  if (year) params.year = year
  return downloadFileByPath(`/api/files/download/incoming/${documentId}`, { params })
}

export async function downloadOutgoingFile(documentId, { db, year } = {}) {
  const params = {}
  if (db) params.db = db
  if (year) params.year = year
  return downloadFileByPath(`/api/files/download/outgoing/${documentId}`, { params })
}

export async function downloadLegacyIncomingFile(documentId, { db, year } = {}) {
  const params = {}
  if (db) params.db = db
  if (year) params.year = year
  return downloadFileByPath(`/api/files/download/${documentId}`, { params })
}
