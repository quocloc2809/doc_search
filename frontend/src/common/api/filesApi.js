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

export async function downloadIncomingFile(documentId, { db, year, title } = {}) {
  const params = {}
  if (db) params.db = db
  if (year) params.year = year
  if (title) params.title = title
  return downloadFileByPath(`/api/files/download/incoming/${documentId}`, { params })
}

export async function downloadOutgoingFile(documentId, { db, year, title } = {}) {
  const params = {}
  if (db) params.db = db
  if (year) params.year = year
  if (title) params.title = title
  return downloadFileByPath(`/api/files/download/outgoing/${documentId}`, { params })
}

export async function downloadLegacyIncomingFile(documentId, { db, year } = {}) {
  const params = {}
  if (db) params.db = db
  if (year) params.year = year
  return downloadFileByPath(`/api/files/download/${documentId}`, { params })
}

export async function mergeFiles(items) {
  try {
    const response = await httpClient.post('/api/files/merge', { items }, { responseType: 'blob' })
    return {
      blob: response.data,
      fileName: 'VanBanTongHop.pdf',
      contentType: 'application/pdf',
      mergedCount: parseInt(response.headers['x-merged-count'] || '0', 10),
      skippedCount: parseInt(response.headers['x-skipped-count'] || '0', 10),
    }
  } catch (err) {
    // When responseType is 'blob', axios returns error.response.data as a Blob.
    // Parse it to JSON to get the real server error message.
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const json = JSON.parse(text)
        const enhanced = new Error(json.message || 'Merge file thất bại')
        enhanced.response = { ...err.response, data: json }
        throw enhanced
      } catch (parseErr) {
        if (parseErr.response) throw parseErr
      }
    }
    throw err
  }
}
