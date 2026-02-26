export default function Input({
  id,
  name,
  type = 'text',
  value,
  onChange,
  placeholder,
  label,
  autoComplete,
}) {
  return (
    <div className="common-field">
      {label ? <label htmlFor={id || name}>{label}</label> : null}
      <input
        id={id || name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoComplete={autoComplete}
        className="common-input"
      />
    </div>
  )
}
