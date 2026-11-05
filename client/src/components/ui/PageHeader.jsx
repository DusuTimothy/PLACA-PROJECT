/**
 * Page title, short explanation and optional actions.
 */
export default function PageHeader({ title, intro, actions, children }) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink sm:text-3xl">{title}</h1>
          {intro && (
            <p className="mt-1 max-w-2xl text-base leading-relaxed text-slate-600">{intro}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
