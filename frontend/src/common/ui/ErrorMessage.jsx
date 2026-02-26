export default function ErrorMessage({ message }) {
  if (!message) {
    return null
  }

  return <div className="common-error">{message}</div>
}
