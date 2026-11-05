/**
 * Plain-language message box. `role="alert"` makes errors announce to screen readers.
 */

const styles = {
  error: 'border-red-300 bg-red-50 text-red-900',
  success: 'border-green-300 bg-green-50 text-green-900',
  info: 'border-sky-300 bg-sky-50 text-sky-900',
  warning: 'border-amber-300 bg-amber-50 text-amber-900',
};

export default function Alert({ variant = 'info', title, children }) {
  return (
    <div
      role={variant === 'error' ? 'alert' : 'status'}
      className={`rounded-xl border p-4 text-base leading-relaxed ${styles[variant]}`}
    >
      {title && <p className="mb-1 font-bold">{title}</p>}
      <div>{children}</div>
    </div>
  );
}
