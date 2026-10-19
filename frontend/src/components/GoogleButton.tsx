import { useEffect, useRef, useState } from 'react';
import { DEMO } from '../api/client';

const CLIENT_ID: string = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '';
/** Off unless a client ID from Google Cloud is set (the demo then shows a stand-in button). */
export const GOOGLE_SIGN_IN = !!CLIENT_ID;

type Gsi = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; use_fedcm_for_button?: boolean }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};
declare global { interface Window { google?: Gsi } }

// Google's script loads once, only when the login page needs it.
let gsi: Promise<Gsi> | null = null;
function loadGsi(): Promise<Gsi> {
  gsi ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => (window.google ? resolve(window.google) : reject(new Error('no gsi')));
    s.onerror = () => { gsi = null; s.remove(); reject(new Error('gsi blocked')); };
    document.head.appendChild(s);
  });
  return gsi;
}

// Google wants initialize() once per page, so it hands every token to whichever button is showing.
let deliver: ((credential: string) => void) | null = null;
let initialized = false;

/**
 * Google's own "Continue with Google" button (their branding rules), dark to sit on the backdrop.
 * The popup runs on Google's side and gives back a signed ID token, which the backend checks.
 */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  deliver = onCredential;

  useEffect(() => {
    if (DEMO) return;
    let live = true;
    loadGsi().then((g) => {
      if (!live || !box.current) return;
      if (!initialized) {
        g.accounts.id.initialize({ client_id: CLIENT_ID, callback: (r) => deliver?.(r.credential), use_fedcm_for_button: true });
        initialized = true;
      }
      g.accounts.id.renderButton(box.current, {
        type: 'standard', theme: 'filled_black', size: 'large', text: 'continue_with', shape: 'rectangular',
        logo_alignment: 'center', width: Math.min(400, Math.max(200, box.current.clientWidth)),
      });
    }).catch(() => { if (live) setFailed(true); });
    return () => { live = false; };
  }, []);

  if (DEMO) {
    return (
      <button type="button" onClick={() => onCredential('demo')}
        className="h-12 w-full rounded-md border border-white/20 bg-[#131314] text-sm font-semibold text-white transition hover:bg-white/10">
        Continue with Google <span className="font-normal text-white/50">(demo)</span>
      </button>
    );
  }
  if (failed) return <p className="text-sm text-white/60">Google sign-in didn't load. Use your email below.</p>;
  // Holds the button's height while Google's script loads, so nothing below it jumps. Light scheme:
  // the page is `color-scheme: dark`, and browsers paint a white box behind an iframe whose scheme differs.
  return <div ref={box} className="flex min-h-[44px] w-full justify-center [color-scheme:light]" />;
}
