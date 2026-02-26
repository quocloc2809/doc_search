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

async function downloadFileByPath(path) {
  const response = await httpClient.get(path, { responseType: 'blob' })

  return {
    blob: response.data,
    fileName: extractFileNameFromContentDisposition(response.headers['content-disposition']),
    contentType: response.headers['content-type'] || response.data?.type,
  }
}

export async function downloadIncomingFile(documentId) {
  return downloadFileByPath(`/api/files/download/incoming/${documentId}`)
}

export async function downloadOutgoingFile(documentId) {
  return downloadFileByPath(`/api/files/download/outgoing/${documentId}`)
}

export async function downloadLegacyIncomingFile(documentId) {
  return downloadFileByPath(`/api/files/download/${documentId}`)
}
