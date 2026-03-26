import Select from 'react-select';

export default function CustomSelect({
    id,
    value,
    options,
    placeholder,
    onChange,
    isClearable = false,
    isSearchable = true,
}) {
    return (
        <Select
            id={id}
            value={options.find(opt => opt.value === value) || null}
            options={options}
            placeholder={placeholder}
            onChange={onChange}
            isClearable={isClearable}
            isSearchable={isSearchable}
        />
    );
}
