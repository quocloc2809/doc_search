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

export async function zipFiles(items) {
  const zipTimeoutMs = Number(import.meta.env.VITE_ZIP_TIMEOUT_MS || 600000)

  try {
    const response = await httpClient.post('/api/files/zip', { items }, {
      responseType: 'blob',
      timeout: zipTimeoutMs,
    })
    return {
      blob: response.data,
      fileName: 'VanBanTongHop.zip',
      contentType: 'application/zip',
      fileCount: parseInt(response.headers['x-file-count'] || '0', 10),
      skippedCount: parseInt(response.headers['x-skipped-count'] || '0', 10),
    }
  } catch (err) {
    if (err?.code === 'ECONNABORTED') {
      throw new Error('Tải ZIP quá thời gian chờ. Vui lòng thử lại hoặc chọn ít văn bản hơn.')
    }
    if (err?.response?.status === 413) {
      throw new Error('Danh sách văn bản quá lớn. Vui lòng thử chọn ít hơn.')
    }
    if (err?.response?.data instanceof Blob) {
      try {
        const text = await err.response.data.text()
        const json = JSON.parse(text)
        const enhanced = new Error(json.message || 'Tải file thất bại')
        enhanced.response = { ...err.response, data: json }
        throw enhanced
      } catch (parseErr) {
        if (parseErr.response) throw parseErr
      }
    }
    throw err
  }
}
