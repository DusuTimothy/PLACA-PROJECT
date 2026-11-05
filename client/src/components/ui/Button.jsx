/**
 * Large, high-contrast button. Minimum height 44px for touch use.
 */

const styles = {
  primary:
    'bg-placa-600 text-white hover:bg-placa-700 disabled:bg-slate-400 disabled:cursor-not-allowed',
  secondary:
    'border-2 border-placa-600 bg-white text-placa-700 hover:bg-placa-50 disabled:border-slate-300 disabled:text-slate-400',
  danger: 'bg-red-700 text-white hover:bg-red-800 disabled:bg-slate-400',
  ghost: 'text-placa-700 hover:bg-placa-50',
};

export default function Button({
  children,
  type = 'button',
  variant = 'primary',
  loading = false,
  disabled = false,
  fullWidth = false,
  className = '',
  ...rest
}) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={`inline-flex min-h-tap items-center justify-center gap-2 rounded-xl px-5 py-3 text-base font-semibold transition focus-visible:ring-4 focus-visible:ring-placa-300 ${
        styles[variant]
      } ${fullWidth ? 'w-full' : ''} ${className}`}
      {...rest}
    >
      {loading && (
        <span
          aria-hidden="true"
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      <span>{loading ? '…' : children}</span>
    </button>
  );
}
