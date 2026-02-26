export function isRequired(value) {
  return String(value || '').trim().length > 0
}

export function isEmail(value) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(String(value || '').trim())
}

export function minLength(value, min) {
  return String(value || '').length >= min
}
