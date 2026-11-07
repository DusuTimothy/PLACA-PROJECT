import { Component } from 'react';
import i18n from '../i18n';
import { isChunkLoadError, reloadOnce } from '../utils/reload';

/**
 * Last line of defence against a blank white screen.
 *
 * Without a boundary, a render error in any page unmounts the whole React tree
 * and the user sees nothing. This keeps the page usable: it explains what
 * happened, offers a reload and a way back to the dashboard, and still works
 * when the failure came from a stale service-worker bundle.
 */
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('[placa] page failed to render', error, info?.componentStack);

    // A missing chunk cannot be fixed by re-rendering. Reload once to fetch the
    // current bundle; the cooldown prevents a loop on a flaky connection.
    if (isChunkLoadError(error)) reloadOnce('chunk');
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const t = i18n.t.bind(i18n);
    const staleBundle = isChunkLoadError(error);

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
        <div
          role="alert"
          className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <span
            aria-hidden="true"
            className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-placa-600 text-lg font-black text-white"
          >
            P
          </span>
          <h1 className="text-xl font-bold text-ink">
            {staleBundle ? t('crash.updateTitle') : t('crash.title')}
          </h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            {staleBundle ? t('crash.updateBody') : t('crash.body')}
          </p>

          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={this.handleReload}
              className="inline-flex min-h-tap items-center justify-center rounded-xl bg-placa-600 px-5 py-3 text-base font-semibold text-white transition hover:bg-placa-700 focus-visible:ring-4 focus-visible:ring-placa-300"
            >
              {staleBundle ? t('crash.updateAction') : t('crash.reload')}
            </button>
            <a
              href="/app/dashboard"
              className="inline-flex min-h-tap items-center justify-center rounded-xl border-2 border-placa-600 bg-white px-5 py-3 text-base font-semibold text-placa-700 transition hover:bg-placa-50 focus-visible:ring-4 focus-visible:ring-placa-300"
            >
              {t('crash.dashboard')}
            </a>
          </div>

          {import.meta.env.DEV && (
            <pre className="mt-5 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-xs text-slate-700">
              {String(error?.stack || error)}
            </pre>
          )}
        </div>
      </div>
    );
  }
}
