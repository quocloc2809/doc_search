import { useState } from 'react'
import { filesApi } from '../api'

function downloadBlob({ blob, fileName }) {
  const blobUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = blobUrl
  anchor.download = fileName || 'downloaded-file'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(blobUrl)
}

export function useFileDownload() {
  const [isDownloading, setIsDownloading] = useState(false)
  const [error, setError] = useState('')

  const runDownload = async (handler) => {
    setIsDownloading(true)
    setError('')

    try {
      const result = await handler()
      downloadBlob(result)
      return result
    } catch (apiError) {
      const message = apiError?.response?.data?.message || 'Tải file thất bại'
      setError(message)
      throw apiError
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadIncomingFile = (documentId, db) => runDownload(() => filesApi.downloadIncomingFile(documentId, { db }))
  const downloadOutgoingFile = (documentId, db) => runDownload(() => filesApi.downloadOutgoingFile(documentId, { db }))
  const downloadLegacyIncomingFile = (documentId, db) => runDownload(() => filesApi.downloadLegacyIncomingFile(documentId, { db }))

  return {
    isDownloading,
    error,
    downloadIncomingFile,
    downloadOutgoingFile,
    downloadLegacyIncomingFile,
  }
}
