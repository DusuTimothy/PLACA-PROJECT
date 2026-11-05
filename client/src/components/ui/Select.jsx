import { useTranslation } from 'react-i18next';

/**
 * Accessible select with the same label/hint/error order as Input.
 */

export default function Select({
  label,
  hint,
  error,
  id,
  required = false,
  children,
  className = '',
  ...rest
}) {
  const { t } = useTranslation();
  const inputId = id || `select-${label?.replace(/\s+/g, '-').toLowerCase()}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={inputId} className="placa-label">
        {label}
        {required && <span className="sr-only"> ({t('common.required')})</span>}
      </label>
      <select
        id={inputId}
        required={required}
        aria-invalid={error ? 'true' : 'false'}
        aria-describedby={describedBy || undefined}
        className={`placa-input ${error ? 'border-red-700 ring-2 ring-red-200' : ''}`}
        {...rest}
      >
        {children}
      </select>
      {hint && !error && (
        <p id={hintId} className="placa-hint">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} className="mt-1 text-sm font-medium text-red-800">
          {error}
        </p>
      )}
    </div>
  );
}
