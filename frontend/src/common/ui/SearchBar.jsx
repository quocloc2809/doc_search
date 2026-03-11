import { useState } from 'react'

/**
 * @param {object} props
 * @param {string} [props.value] - Giá trị ban đầu của ô tìm kiếm
 * @param {function} [props.onSearch] - Gọi khi submit form: (keyword, field) => void
 * @param {function} [props.onLiveSearch] - Gọi realtime khi gõ/đổi field: (keyword, field) => void
 * @param {string} [props.placeholder]
 * @param {Array<{value: string, label: string}>} [props.searchFields] - Danh sách tùy chọn cho combobox
 * @param {string} [props.searchField] - Controlled: field đang chọn
 * @param {function} [props.onSearchFieldChange] - Controlled: setter cho searchField
 * @param {string} [props.className]
 * @param {object} [props.style]
 */
export default function SearchBar({
  value,
  onSearch,
  onLiveSearch,
  placeholder = 'Tìm kiếm...',
  searchFields,
  searchField: controlledField,
  onSearchFieldChange,
  className,
  style,
}) {
  const [keyword, setKeyword] = useState(() => value || '')
  const [internalField, setInternalField] = useState(() => searchFields?.[0]?.value ?? 'all')
  const [isFieldFocused, setIsFieldFocused] = useState(false)

  const currentField = controlledField !== undefined ? controlledField : internalField

  const handleFieldChange = (event) => {
    const newField = event.target.value
    event.target.blur()
    if (onSearchFieldChange) {
      onSearchFieldChange(newField)
    } else {
      setInternalField(newField)
    }
    onLiveSearch?.(keyword.trim(), newField)
  }

  const handleInputChange = (event) => {
    const newKeyword = event.target.value
    setKeyword(newKeyword)
    onLiveSearch?.(newKeyword.trim(), currentField)
  }

  const handleSubmit = (event) => {
    event.preventDefault()
    onSearch?.(keyword.trim(), currentField)
  }

  const handleClear = () => {
    setKeyword('')
    onSearch?.('', currentField)
    onLiveSearch?.('', currentField)
  }

  return (
    <form
      className={['common-searchbar', className].filter(Boolean).join(' ')}
      style={style}
      onSubmit={handleSubmit}
    >
      <div className="common-searchbar-group">
        {searchFields?.length > 0 && (
          <select
            className={['common-searchbar-field', isFieldFocused ? 'common-searchbar-field--active' : ''].filter(Boolean).join(' ')}
            value={currentField}
            onChange={handleFieldChange}
            onMouseDown={(event) => {
              if (document.activeElement === event.currentTarget) {
                event.preventDefault()
                event.currentTarget.blur()
              }
            }}
            onFocus={() => setIsFieldFocused(true)}
            onBlur={() => setIsFieldFocused(false)}
          >
            {searchFields.map((field) => (
              <option key={field.value} value={field.value}>{field.label}</option>
            ))}
          </select>
        )}
        <input
          className="common-input"
          value={keyword}
          onChange={handleInputChange}
          placeholder={placeholder}
        />
        {keyword && (
          <button
            type="button"
            className="common-searchbar-clear"
            onClick={handleClear}
            tabIndex={-1}
            aria-label="Xóa"
          >
            ×
          </button>
        )}
        {onSearch && (
          <button
            type="submit"
            className="common-searchbar-submit"
            aria-label="Tìm kiếm"
          >
            Tìm kiếm
          </button>
        )}
      </div>
    </form>
  )
}
