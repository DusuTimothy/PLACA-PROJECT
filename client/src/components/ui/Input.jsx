import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

/**
 * Accessible text input with label, hint and error in that order.
 * The hint appears under the field so a user reads the label first, then help.
 */

export default function Input({
  label,
  hint,
  error,
  type = 'text',
  id,
  required = false,
  optionalLabel = false,
  className = '',
  ...rest
}) {
  const generatedId = useId();
  const inputId = id || `field-${generatedId}`;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  const { t } = useTranslation();
  const [revealed, setRevealed] = useState(false);

  const isPassword = type === 'password';
  const inputType = isPassword && revealed ? 'text' : type;
  const describedBy = [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(' ');

  return (
    <div className={className}>
      <label htmlFor={inputId} className="placa-label">
        {label}
        {required && <span className="sr-only"> ({t('common.required')})</span>}
        {optionalLabel && <span className="ml-1 text-sm font-normal text-slate-500">({t('common.optional')})</span>}
      </label>

      <div className="relative">
        <input
          id={inputId}
          type={inputType}
          required={required}
          aria-invalid={error ? 'true' : 'false'}
          aria-describedby={describedBy || undefined}
          className={`placa-input ${isPassword ? 'pr-24' : ''} ${
            error ? 'border-red-700 ring-2 ring-red-200' : ''
          }`}
          {...rest}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((value) => !value)}
            className="absolute inset-y-0 right-2 my-auto h-10 rounded-lg px-3 text-sm font-semibold text-placa-700 hover:bg-placa-50"
            aria-label={revealed ? t('common.hidePassword') : t('common.showPassword')}
          >
            {revealed ? t('common.hidePassword') : t('common.showPassword')}
          </button>
        )}
      </div>

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
