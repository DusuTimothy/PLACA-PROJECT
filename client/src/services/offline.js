import { useEffect, useState } from 'react';
import {
  cacheGet,
  cacheSet,
  listOutbox,
  onOutboxChange,
  outboxCount,
} from './offlineDb';

/**
 * Small helpers shared by every offline-aware page.
 */

export function isOnline() {
  return typeof navigator === 'undefined' ? true : navigator.onLine !== false;
}

/** True when the request never reached the server (no HTTP response). */
export function isNetworkError(error) {
  return !error?.response;
}

/**
 * Read-through cache. A successful request refreshes the cache; a request that
 * cannot reach the server falls back to the last saved response.
 */
export async function readThrough(key, request) {
  try {
    const value = await request();
    await cacheSet(key, value);
    return { value, fromCache: false };
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = await cacheGet(key);
      if (cached !== null && cached !== undefined) {
        return { value: cached, fromCache: true };
      }
    }
    throw error;
  }
}

export function useOnline() {
  const [online, setOnline] = useState(isOnline);

  useEffect(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  return online;
}

export function useOutbox() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      listOutbox().then((rows) => {
        if (active) setItems(rows);
      });
    };
    refresh();
    const stop = onOutboxChange(refresh);
    window.addEventListener('online', refresh);
    return () => {
      active = false;
      stop();
      window.removeEventListener('online', refresh);
    };
  }, []);

  return items;
}

export function useOutboxCount() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = () => {
      outboxCount().then((value) => {
        if (active) setCount(value);
      });
    };
    refresh();
    const stop = onOutboxChange(refresh);
    return () => {
      active = false;
      stop();
    };
  }, []);

  return count;
}
