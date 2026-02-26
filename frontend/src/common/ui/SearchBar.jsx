import { useState } from 'react'
import Button from './Button'

export default function SearchBar({
  value,
  onSearch,
  placeholder = 'Tìm kiếm...',
  searchButtonLabel = 'Tìm',
  clearButtonLabel = 'Xóa',
}) {
  const [keyword, setKeyword] = useState(() => value || '')

  const handleSubmit = (event) => {
    event.preventDefault()
    onSearch?.(keyword.trim())
  }

  const handleClear = () => {
    setKeyword('')
    onSearch?.('')
  }

  return (
    <form className="common-searchbar" onSubmit={handleSubmit}>
      <input
        className="common-input"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder={placeholder}
      />
      <Button type="submit">{searchButtonLabel}</Button>
      <Button type="button" onClick={handleClear}>
        {clearButtonLabel}
      </Button>
    </form>
  )
}
