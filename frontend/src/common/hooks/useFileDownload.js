import { useState } from 'react'
import { filesApi } from '../api'

function inferExtensionFromContentType(contentType = '') {
  const normalized = String(contentType || '').toLowerCase()
  if (normalized.includes('pdf')) return '.pdf'
  if (normalized.includes('msword')) return '.doc'
  if (normalized.includes('wordprocessingml')) return '.docx'
  if (normalized.includes('spreadsheetml')) return '.xlsx'
  if (normalized.includes('excel')) return '.xls'
  return ''
}

function getExtension(fileName = '') {
  const matched = String(fileName || '').match(/(\.[a-z0-9]+)$/i)
  return matched ? matched[1] : ''
}

function buildPreferredFileName({ suggestedTitle, serverFileName, contentType }) {
  const trimmedTitle = String(suggestedTitle || '').trim()
  if (!trimmedTitle) {
    return serverFileName || 'downloaded-file'
  }

  const hasExtensionInTitle = /\.[a-z0-9]+$/i.test(trimmedTitle)
  if (hasExtensionInTitle) {
    return trimmedTitle
  }

  const extFromServer = getExtension(serverFileName)
  const ext = extFromServer || inferExtensionFromContentType(contentType)
  return `${trimmedTitle}${ext}`
}

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

  const runDownload = async (handler, suggestedTitle) => {
    setIsDownloading(true)
    setError('')

    try {
      const result = await handler()
      const preferredFileName = buildPreferredFileName({
        suggestedTitle,
        serverFileName: result?.fileName,
        contentType: result?.contentType || result?.blob?.type,
      })

      downloadBlob({
        ...result,
        fileName: preferredFileName,
      })
      return result
    } catch (apiError) {
      const message = apiError?.response?.data?.message || 'Tải file thất bại'
      setError(message)
      throw apiError
    } finally {
      setIsDownloading(false)
    }
  }

  const downloadIncomingFile = (documentId, db, title, year) => runDownload(() => filesApi.downloadIncomingFile(documentId, { db, title, year }), title)
  const downloadOutgoingFile = (documentId, db, title, year) => runDownload(() => filesApi.downloadOutgoingFile(documentId, { db, title, year }), title)
  const downloadLegacyIncomingFile = (documentId, db, year) => runDownload(() => filesApi.downloadLegacyIncomingFile(documentId, { db, year }))

  const mergeBulkDownload = async (items) => {
    setIsDownloading(true)
    setError('')
    try {
      const result = await filesApi.mergeFiles(items)
      downloadBlob({ blob: result.blob, fileName: result.fileName })
      return result
    } catch (apiError) {
      const message = apiError?.response?.data?.message || 'Merge file thất bại'
      setError(message)
      throw apiError
    } finally {
      setIsDownloading(false)
    }
  }

  return {
    isDownloading,
    error,
    downloadIncomingFile,
    downloadOutgoingFile,
    downloadLegacyIncomingFile,
    mergeBulkDownload,
  }
}
