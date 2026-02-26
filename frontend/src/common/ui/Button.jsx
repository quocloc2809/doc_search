export default function Button({ type = 'button', disabled = false, onClick, children, className = '' }) {
  const classes = `common-button ${className}`.trim()

  return (
    <button type={type} disabled={disabled} onClick={onClick} className={classes}>
      {children}
    </button>
  )
}
