// src/components/common/CloseButton.tsx
import type { ButtonHTMLAttributes, CSSProperties } from 'react';

export interface CloseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'style'> {
  ariaLabel?: string;
  style?: CSSProperties;
}

const CloseButton = ({
  onClick,
  ariaLabel = 'Cerrar',
  style,
  ...props
}: CloseButtonProps) => {
  return (
    <button
      onClick={onClick}
      aria-label={ariaLabel}
      style={{
        position: 'absolute',
        top: 10,
        right: 15,
        fontSize: 22,
        background: 'none',
        border: 'none',
        color: '#555',
        cursor: 'pointer',
        transition: 'color 0.2s',
        ...style,
      }}
      {...props}
    >
      ✖
    </button>
  );
};

export default CloseButton;
