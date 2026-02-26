import { useId } from 'react'

export default function Tooltip({ content, children, position = 'top' }) {
  const tooltipId = useId()

  if (!content) {
    return children
  }

  return (
    <span className={`common-tooltip-wrapper common-tooltip-${position}`}>
      <span aria-describedby={tooltipId} className="common-tooltip-trigger">{children}</span>
      <span id={tooltipId} role="tooltip" className="common-tooltip-content">
        {content}
      </span>
    </span>
  )
}
