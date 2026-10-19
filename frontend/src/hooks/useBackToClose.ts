import { useEffect, useRef } from 'react';

/**
 * While `open`, the Android back button (and browser back) closes this menu or dialog
 * instead of leaving the page. Opening pushes a same-URL history entry; back pops it.
 * Anything that navigates away while open should use `navigate(to, { replace: true })`
 * so it replaces that entry rather than leaving a stray one behind.
 */
export function useBackToClose(open: boolean, close: () => void) {
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    if (!open) return;
    const layer = Date.now();
    // keep the router's own state (its index), so it sees this as the same page
    history.pushState({ ...(history.state ?? {}), crqlLayer: layer }, '');
    let popped = false;
    const onPop = () => { popped = true; closeRef.current(); };
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('popstate', onPop);
      // closed some other way (tap outside, Esc, a button): drop our entry again
      if (!popped && history.state?.crqlLayer === layer) history.back();
    };
  }, [open]);
}
