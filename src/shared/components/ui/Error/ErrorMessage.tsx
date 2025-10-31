import React from 'react';
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline';

type ErrorMessageProps = {
  message: React.ReactNode;
  title?: React.ReactNode;
  onRetry?: () => void;
  showIcon?: boolean;
  className?: string;
};

const ErrorMessage: React.FC<ErrorMessageProps> = ({
  message,
  title = 'Error',
  onRetry,
  showIcon = true,
  className = '',
}) => {
  return (
    <div className={`bg-red-50 border border-red-200 rounded-lg p-4 ${className}`}>
      <div className="flex items-start">
        {showIcon && (
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mt-0.5 mr-3 flex-shrink-0" />
        )}
        <div className="flex-1">
          {title ? (
            <h3 className="text-sm font-medium text-red-800 mb-1">
              {title}
            </h3>
          ) : null}
          <p className="text-sm text-red-700 mb-3">
            {message}
          </p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-red-700 bg-red-100 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              Intentar nuevamente
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(ErrorMessage);
