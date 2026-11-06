import { useEffect, useRef, useState } from 'react';

// Update detection without a service worker. The app is a plain static site on
// GitHub Pages, so a fresh load is at most ~10 minutes behind a deploy (Pages sends
// max-age=600). The problem is a tab left open: it keeps running the build it
// started with. So when the tab is shown again (and hourly as a backstop) we fetch
// version.json, which every build writes, and compare its build id with our own.
//
// Never reloads by itself: a reload discards the uploaded CVs and extracted results.

/** The backstop. The visibility check below does nearly all the work. */
const UPDATE_INTERVAL_MS = 60 * 60 * 1000;

// Written by the versionFile() plugin in vite.config.ts, next to index.html
const VERSION_URL = `${import.meta.env.BASE_URL}version.json`;

export function useAppUpdate() {
  const [needRefresh, setNeedRefresh] = useState(false);
  const [latestVersion, setLatestVersion] = useState<number | null>(null);
  // Survives a dismissal: the page doesn't stop being behind because the offer was
  // waved away. Without this, Later would only last until the next check anyway, but
  // keeping it means a failed fetch (e.g. offline) can't make the offer disappear.
  const stale = useRef(false);

  useEffect(() => {
    // The dev server has no version.json and its code is always current
    if (!import.meta.env.PROD) return;

    let cancelled = false;
    const announce = () => {
      stale.current = true;
      if (!cancelled) setNeedRefresh(true);
    };

    const check = async () => {
      try {
        // no-store + a unique query so neither the browser nor the CDN answers from cache
        const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) {
          // A missing version.json looks exactly like an app that is up to date,
          // so at least leave a trace of it
          console.warn(`⚠️ Update check: ${VERSION_URL} returned ${res.status}`);
        } else {
          const latest: { version?: number; build?: string } = await res.json();
          if (latest.build && latest.build !== __BUILD_ID__) {
            if (!cancelled && typeof latest.version === 'number') setLatestVersion(latest.version);
            announce();
            return;
          }
        }
      } catch {
        // Offline or a flaky network: try again on the next check
      }
      if (stale.current) announce(); // still behind from an earlier check
    };

    const timer = window.setInterval(check, UPDATE_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return {
    needRefresh,
    latestVersion,
    updateApp: () => window.location.reload(),
    // Keep this build for now — the offer returns on the next check
    dismiss: () => setNeedRefresh(false),
  };
}
