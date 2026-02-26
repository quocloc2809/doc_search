function toNumber(value, fieldName) {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${fieldName} phải là số dương`)
  }

  return Math.floor(parsed)
}

function normalizeLongColumns(longColumns = []) {
  if (Array.isArray(longColumns)) {
    return longColumns
      .filter((item) => item && Number.isFinite(Number(item.index)) && Number.isFinite(Number(item.width)))
      .map((item) => ({ index: Number(item.index), width: Number(item.width) }))
  }

  if (typeof longColumns === 'object' && longColumns !== null) {
    return Object.entries(longColumns)
      .filter(([index, width]) => Number.isFinite(Number(index)) && Number.isFinite(Number(width)))
      .map(([index, width]) => ({ index: Number(index), width: Number(width) }))
  }

  return []
}

export function calculateTableLayout({
  columnCount,
  tableWidth,
  longColumns = [],
  minAutoColumnWidth = 80,
  fitToTableWidth = true,
  minColumnWidth = 56,
}) {
  const safeColumnCount = toNumber(columnCount, 'columnCount')
  const safeTableWidth = toNumber(tableWidth, 'tableWidth')
  const safeMinAutoColumnWidth = toNumber(minAutoColumnWidth, 'minAutoColumnWidth')

  const longColumnItems = normalizeLongColumns(longColumns)
  const longColumnMap = new Map()

  longColumnItems.forEach(({ index, width }) => {
    const normalizedIndex = Math.floor(index)
    const normalizedWidth = Math.floor(width)

    if (normalizedIndex >= 0 && normalizedIndex < safeColumnCount && normalizedWidth > 0) {
      longColumnMap.set(normalizedIndex, normalizedWidth)
    }
  })

  const fixedTotalWidth = [...longColumnMap.values()].reduce((sum, width) => sum + width, 0)
  const autoColumnCount = safeColumnCount - longColumnMap.size

  let availableAutoWidth = Math.max(0, safeTableWidth - fixedTotalWidth)
  let autoColumnWidth = autoColumnCount > 0
    ? Math.max(0, Math.floor(availableAutoWidth / autoColumnCount))
    : 0

  if (autoColumnCount > 0 && autoColumnWidth < safeMinAutoColumnWidth) {
    autoColumnWidth = safeMinAutoColumnWidth
    availableAutoWidth = autoColumnWidth * autoColumnCount
  }

  const widths = Array.from({ length: safeColumnCount }, (_, index) => (
    longColumnMap.has(index) ? longColumnMap.get(index) : autoColumnWidth
  ))

  let finalWidths = widths
  const rawUsedWidth = widths.reduce((sum, width) => sum + width, 0)

  if (fitToTableWidth && rawUsedWidth > safeTableWidth) {
    const safeMinColumnWidth = Math.max(32, Math.floor(Number(minColumnWidth) || 56))
    const scale = safeTableWidth / rawUsedWidth

    finalWidths = widths.map((width) => Math.max(safeMinColumnWidth, Math.floor(width * scale)))

    let adjustedUsedWidth = finalWidths.reduce((sum, width) => sum + width, 0)
    let delta = safeTableWidth - adjustedUsedWidth

    if (delta > 0) {
      let index = 0
      while (delta > 0) {
        finalWidths[index % finalWidths.length] += 1
        delta -= 1
        index += 1
      }
    } else if (delta < 0) {
      let index = 0
      while (delta < 0) {
        let changed = false
        for (let i = 0; i < finalWidths.length && delta < 0; i += 1) {
          const targetIndex = (index + i) % finalWidths.length
          if (finalWidths[targetIndex] > safeMinColumnWidth) {
            finalWidths[targetIndex] -= 1
            delta += 1
            changed = true
          }
        }

        if (!changed) {
          break
        }

        index += 1
      }
    }
  }

  const usedWidth = finalWidths.reduce((sum, width) => sum + width, 0)
  const overflowWidth = Math.max(0, usedWidth - safeTableWidth)

  return {
    tableWidth: safeTableWidth,
    usedWidth,
    overflowWidth,
    columnWidths: finalWidths,
    columnStyles: finalWidths.map((width) => ({
      width: `${width}px`,
      minWidth: `${width}px`,
      maxWidth: `${width}px`,
    })),
  }
}
