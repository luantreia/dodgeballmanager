// src/components/common/FormComponents/InputText.tsx
import type { ChangeEventHandler, CSSProperties, InputHTMLAttributes, ReactNode } from 'react';

export interface InputTextProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: ReactNode;
  name: string;
  value: string | number | readonly string[];
  onChange: ChangeEventHandler<HTMLInputElement>;
  error?: ReactNode;
  containerStyle?: CSSProperties;
}

const InputText = ({
  label,
  name,
  value,
  onChange,
  placeholder = '',
  type = 'text',
  error,
  disabled = false,
  containerStyle,
  ...props
}: InputTextProps) => {
  return (
    <div style={{ ...styles.container, ...containerStyle }}>
      {label && <label htmlFor={name} style={styles.label}>{label}</label>}
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        style={{
          ...styles.input,
          ...(error ? styles.inputError : {}),
        }}
        {...props}
      />
      {error && <div style={styles.error}>{error}</div>}
    </div>
  );
};

export default InputText;

const styles: Record<'container' | 'label' | 'input' | 'inputError' | 'error', CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
  },
  label: {
    marginBottom: '4px',
    fontSize: '14px',
    fontWeight: '500',
  },
  input: {
    padding: '8px',
    fontSize: '14px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  inputError: {
    borderColor: '#dc3545',
  },
  error: {
    marginTop: '4px',
    fontSize: '12px',
    color: '#dc3545',
  },
};
