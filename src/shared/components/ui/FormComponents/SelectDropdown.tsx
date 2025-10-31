// src/components/common/FormComponents/SelectDropdown.tsx
import type { ChangeEventHandler, CSSProperties, ReactNode, SelectHTMLAttributes } from 'react';

export type SelectDropdownOption = { value: string | number; label: ReactNode };

export interface SelectDropdownProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'value' | 'onChange' | 'multiple'> {
  label?: ReactNode;
  name: string;
  value: string | number | readonly string[];
  options?: SelectDropdownOption[];
  onChange: ChangeEventHandler<HTMLSelectElement>;
  placeholder?: string;
  error?: ReactNode;
  disabled?: boolean;
  containerStyle?: CSSProperties;
}

const SelectDropdown = ({
  label,
  name,
  value,
  options = [],
  onChange,
  placeholder,
  error,
  disabled = false,
  containerStyle,
  ...props
}: SelectDropdownProps) => {
  return (
    <div style={{ ...styles.container, ...containerStyle }}>
      {label && <label htmlFor={name} style={styles.label}>{label}</label>}
      <select
        id={name}
        name={name}
        value={value}
        onChange={onChange}
        disabled={disabled}
        style={{
          ...styles.select,
          ...(error ? styles.selectError : {}),
        }}
        {...props}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
};

export default SelectDropdown;

const styles: Record<'container' | 'label' | 'select' | 'selectError' | 'error', CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500'
  },
  select: {
    color: "var(--color-texto-secundario)",
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '0px solid #ccc',
    outline: 'none',
    transition: 'border-color 0.2s'
  },
  selectError: {
    borderColor: '#dc3545'
  },
  error: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#dc3545'
  }
};
