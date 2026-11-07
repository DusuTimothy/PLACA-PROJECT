/**
 * Recovery helpers for blank screens caused by stale or missing bundles.
 *
 * A new deployment replaces the hashed JavaScript files. A browser that still
 * holds the previous `app.html` (or an open tab) can ask for a file that no
 * longer exists. Vite reports that as a module/preload error. Reloading once
 * picks up the new shell instead of leaving an empty page.
 *
 * The cooldown stops a reload loop when the real problem is the network.
 */

const RELOAD_KEY = 'placa_reload_at';
const RELOAD_COOLDOWN_MS = 30_000;

export function isChunkLoadError(error) {
  const message = String(error?.message || error || '');
  return /dynamically imported module|Loading chunk|Importing a module script failed|Failed to load module script/i.test(
    message
  );
}

export function reloadOnce(reason = 'chunk') {
  try {
    const last = Number(window.sessionStorage.getItem(RELOAD_KEY) || 0);
    if (Date.now() - last < RELOAD_COOLDOWN_MS) return false;
    window.sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // Storage can be unavailable in private mode. Reloading is still safe, but
    // without a cooldown we could loop, so skip the automatic reload instead.
    return false;
  }

  console.warn(`[placa] reloading after ${reason} error`);
  window.location.reload();
  return true;
}
