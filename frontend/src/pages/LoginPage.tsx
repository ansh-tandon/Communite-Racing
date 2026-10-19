import { useCallback, useEffect, useRef, useState, type FormEvent, type Ref } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, Mail, User, Volume2, VolumeX } from 'lucide-react';
import { ApiError, DEMO, tokenStore } from '../api/client';
import { auth } from '../api/endpoints';
import type { TokenOut } from '../api/types';
import { LazyGlobe } from '../components/LazyGlobe';
import { Input } from '../components/ui/input';
import { CardButton } from '../components/ui/sign-in-card-2';
import { CALENDAR, isPast, nextRace, nextUpLabel } from '../fixtures/circuits';
import { cx } from '../components/ui';
import { fmtDateTime } from '../utils/format';
import { useAuth } from '../hooks/useAuth';

const RESEND_SECONDS = 30;

// Red Bull Racing's official GIPHY clip, loaded from GIPHY as GIPHY intends.
const BG_VIDEO = 'https://media.giphy.com/media/UzvlLpSulVBn7ZIucS/giphy.mp4';
const BG_STILL = 'https://media.giphy.com/media/UzvlLpSulVBn7ZIucS/giphy_s.gif';

/**
 * The race footage behind the whole page: greyscale and low in the mix over near-black,
 * so it reads as texture, not a picture, and the palette stays neutral with red accents.
 * A still frame instead under reduced motion or data saver.
 */
function Backdrop() {
  const [still, setStill] = useState(() =>
    matchMedia('(prefers-reduced-motion: reduce)').matches
    || (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true);
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    // React sets `muted` only as a property, and iOS looks for the attribute before it will
    // autoplay inline; without it Safari shows its play button instead.
    v.muted = true;
    v.defaultMuted = true;
    v.setAttribute('muted', '');
    v.setAttribute('playsinline', '');
    // iOS can still refuse (Low Power Mode): then the still frame stands in, never a play button
    const play = () => { if (!document.hidden) v.play().catch(() => setStill(true)); };
    play();
    // Safari doesn't always honour `loop` on this clip: it stops on frame 0 after the first pass.
    // Whenever it stops on its own (or the tab comes back), start it again.
    v.addEventListener('ended', play);
    v.addEventListener('pause', play);
    document.addEventListener('visibilitychange', play);
    return () => {
      v.removeEventListener('ended', play);
      v.removeEventListener('pause', play);
      document.removeEventListener('visibilitychange', play);
    };
  }, []);
  const look = 'h-full w-full object-cover opacity-[0.35] [filter:grayscale(1)_contrast(1.05)]';
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {still ? <img src={BG_STILL} alt="" className={look} /> : (
        <video ref={video} src={BG_VIDEO} poster={BG_STILL} autoPlay muted loop playsInline preload="auto" controls={false}
          disablePictureInPicture disableRemotePlayback tabIndex={-1}
          className={cx(look, '[&::-webkit-media-controls-start-playback-button]:hidden [&::-webkit-media-controls]:hidden')}
          // the source is a 2.6 s loop; a touch slower reads as cinematic rather than frantic
          onLoadedMetadata={(e) => { e.currentTarget.playbackRate = 0.7; }} />
      )}
      {/* neutral shading only: the edges fall to near-black, and the text side is darker still */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_65%_45%,rgba(11,13,16,0.15)_0%,rgba(11,13,16,0.7)_60%,rgba(11,13,16,0.95)_100%)]" />
      <div className="absolute inset-0 bg-gradient-to-b from-[rgba(11,13,16,0.3)] via-[rgba(11,13,16,0.55)] to-[rgba(11,13,16,0.92)] lg:bg-gradient-to-r lg:from-[rgba(11,13,16,0.92)] lg:via-[rgba(11,13,16,0.55)] lg:to-[rgba(11,13,16,0.15)]" />
    </div>
  );
}

// Two lines, each behind its own mask: line 1, then line 2, rising into place.
const HEADLINE = ['Predict the race', 'Own the grid'];
// once per page load, not each time the email step comes back. Marked when the last line lands,
// not on mount: the page can mount twice while it loads, and the second mount is the one seen.
let headlineShown = false;

/**
 * The hero headline as a masked line reveal: each line slides up out of its own
 * overflow-hidden mask while it fades in (380 ms, 200 ms apart, no overshoot). The lines are
 * laid out at their final size from the start and only transform and opacity move, so nothing
 * shifts. Played once; under reduced motion the headline is simply there.
 */
function RevealHeadline() {
  const [animate] = useState(() => !headlineShown);
  // Start once the headline font is in and a frame is painted, so the reveal isn't spent while
  // the page is still busy loading (the globe parses its map then); never more than 700 ms late.
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!animate) return;
    let raf = 0;
    const start = () => { raf = requestAnimationFrame(() => requestAnimationFrame(() => setGo(true))); };
    const cap = window.setTimeout(start, 700);
    document.fonts.ready.then(() => { window.clearTimeout(cap); start(); });
    return () => { window.clearTimeout(cap); cancelAnimationFrame(raf); };
  }, [animate]);
  // 44px, scaled down on the narrowest phones (iPhone SE) so each line stays on one line
  return (
    <h1 className="font-display text-[min(44px,11.5vw)] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-6xl land:text-[44px]">
      {HEADLINE.map((line, i) => (
        // the mask gets a sliver of room above and below (cancelled by the negative margin)
        // so the condensed caps aren't clipped by the tight line height
        <span key={line} className="-my-[0.06em] block overflow-hidden py-[0.06em]">
          <span
            className={cx('block whitespace-nowrap', animate && (go ? 'animate-linein motion-reduce:animate-none' : 'translate-y-full opacity-0 motion-reduce:transform-none motion-reduce:opacity-100'))}
            style={animate && go ? { animationDelay: `${i * 200}ms` } : undefined}
            onAnimationEnd={i === HEADLINE.length - 1 ? () => { headlineShown = true; } : undefined}
          >
            {line}
          </span>
        </span>
      ))}
    </h1>
  );
}

/** The calendar on the globe: it spins in, pins the next race and keeps swaying gently around it. */
function NextRaceGlobe() {
  const [now] = useState(() => new Date());
  const next = nextRace(now);
  const markers = CALENDAR.map((r) => ({ lat: r.lat, lng: r.lng, done: isPast(r, now) }));
  const day = next && (next.start ? fmtDateTime(next.start) : new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(`${next.raceDay}T12:00:00`)));
  return (
    <>
      <LazyGlobe target={next && { lat: next.lat, lng: next.lng, label: nextUpLabel(next) }} markers={markers} route flyIn sway
        // phones: sized by the screen's width (about 90%), capped so it never pushes everything
        // off a short screen; sideways and on laptops it sits beside the form, sized by height
        className="aspect-square w-full max-w-[min(100%,24rem,55svh)] land:max-w-[min(100%,68svh)] lg:max-w-[min(100%,62svh)]" />
      <p className="mt-4 max-w-sm text-center text-sm text-white/60 land:mt-2 lg:mt-6">
        {next
          ? <>{next.start ? 'Lights out' : 'Race day'} <span className="font-semibold text-white">{day}</span>. Every race has its own prediction quiz.</>
          : 'Every Grand Prix on the calendar, one prediction quiz each.'}
      </p>
    </>
  );
}

function OtpInput({ value, onChange, disabled, invalid }: { value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '');
  const setAt = (i: number, d: string) => {
    const arr = digits.slice(); arr[i] = d;
    onChange(arr.join('').slice(0, 6));
  };
  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-3" onPaste={(e) => {
      const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
      if (t) { e.preventDefault(); onChange(t); refs.current[Math.min(t.length, 5)]?.focus(); }
    }}>
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el; }} value={d} disabled={disabled}
          inputMode="numeric" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={6} aria-label={`Digit ${i + 1}`}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, '');
            if (v.length > 1) { onChange((value.slice(0, i) + v).slice(0, 6)); refs.current[Math.min(i + v.length, 5)]?.focus(); return; }
            setAt(i, v); if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !d && i > 0) { refs.current[i - 1]?.focus(); setAt(i - 1, ''); }
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
            if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
          }}
          className={cx('num aspect-square w-full min-w-0 rounded-md border bg-white/[.04] text-center text-2xl font-semibold text-white transition-colors duration-200 focus:bg-white/[.07] focus:outline-none sm:text-3xl',
            invalid ? 'border-accent' : d ? 'border-white/25 focus:border-white/45' : 'border-white/10 focus:border-white/45')} />
      ))}
    </div>
  );
}

// The backend's rules for a display name: spaces tidied, 2 to 24 characters.
const tidyName = (s: string) => s.replace(/\s+/g, ' ').trim();
const nameProblem = (n: string) => (n.length < 2 || n.length > 24 ? 'Your racing name needs 2 to 24 characters.' : null);

/** The racing name field, used on the first screen and (if it was left blank) after the code. */
function NameField({ value, onChange, inputRef, invalid, enterKeyHint }: {
  value: string; onChange: (v: string) => void; inputRef: Ref<HTMLInputElement>; invalid: boolean; enterKeyHint: 'next' | 'go';
}) {
  return (
    <>
      <label htmlFor="login-name" className="sr-only">Your racing name</label>
      <div className="relative flex items-center">
        <User aria-hidden className="pointer-events-none absolute left-3.5 h-4 w-4 text-white/45" />
        <Input ref={inputRef} id="login-name" type="text" autoComplete="nickname" autoCapitalize="words" enterKeyHint={enterKeyHint} maxLength={24}
          placeholder="Your racing name" value={value} aria-invalid={invalid} aria-describedby="login-name-count"
          onChange={(e) => onChange(e.target.value)}
          className="h-12 rounded-md border-white/10 bg-white/[.04] pl-10 pr-14 text-white shadow-none placeholder:text-white/40 focus:bg-white/[.06] focus-visible:border-white/45 focus-visible:ring-0" />
        <span id="login-name-count" aria-live="polite" className="num pointer-events-none absolute right-3.5 text-xs text-white/40">{value.length}/24</span>
      </div>
    </>
  );
}

// ---------- lights out ----------
// The race start after sign-in, drawn and voiced here (no footage): five red lights come on a
// second apart, hold for a random moment like a real start, and go out together.
const LIGHT_EVERY = 1000; // ms between lights
const FIRST_LIGHT = 600; // ms before the first one
const AFTER_OUT = 1500; // ms of "And away we go" before the app opens

/** A short tone through Web Audio; silent if sound is off or the browser hasn't allowed it. */
function tone(ctx: AudioContext | null, freq: number, ms: number, gain = 0.18) {
  if (!ctx || ctx.state !== 'running') return;
  const at = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + ms / 1000);
  o.connect(g).connect(ctx.destination);
  o.start(at);
  o.stop(at + ms / 1000 + 0.05);
}

/**
 * Full-screen start lights. Each light beeps as it comes on, lights out sounds a higher note,
 * then "And away we go" and the app opens. Skip (or Esc) goes straight in; the sound can be
 * switched off and stays off. Under reduced motion the page never shows this (see playLights).
 */
function LightsOutSequence({ show, audio, onDone }: { show: boolean; audio: () => AudioContext | null; onDone: () => void }) {
  const [lit, setLit] = useState(0);
  const [out, setOut] = useState(false);
  const [sound, setSound] = useState(() => { try { return localStorage.getItem('crql:lights-sound') !== 'off'; } catch { return true; } });
  const soundRef = useRef(sound);
  soundRef.current = sound;
  const done = useRef(false);
  const skip = useRef<HTMLButtonElement>(null);
  const finish = useRef(onDone);
  finish.current = () => { if (!done.current) { done.current = true; onDone(); } };

  useEffect(() => {
    if (!show) return;
    const ctx = audio();
    const timers: number[] = [];
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(f, ms));
    for (let i = 1; i <= 5; i++) at(FIRST_LIGHT + (i - 1) * LIGHT_EVERY, () => { setLit(i); if (soundRef.current) tone(ctx, 880, 160); });
    // like a real start, the hold after the fifth light varies, so nobody can anticipate it
    const goes = FIRST_LIGHT + 4 * LIGHT_EVERY + 700 + Math.round(Math.random() * 800);
    at(goes, () => { setLit(0); setOut(true); if (soundRef.current) tone(ctx, 1320, 420, 0.22); });
    at(goes + AFTER_OUT, () => finish.current());
    skip.current?.focus({ preventScroll: true });
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') finish.current(); };
    window.addEventListener('keydown', key);
    return () => { timers.forEach(window.clearTimeout); window.removeEventListener('keydown', key); };
  }, [show, audio]);

  const toggleSound = () => {
    const next = !sound;
    setSound(next);
    try { localStorage.setItem('crql:lights-sound', next ? 'on' : 'off'); } catch { /* private mode */ }
  };

  return (
    <div role="dialog" aria-modal={show || undefined} aria-label="Lights out" aria-hidden={!show}
      className={cx('fixed inset-0 z-[70] flex flex-col items-center justify-center bg-bg px-safe transition-opacity duration-300',
        show ? 'opacity-100' : 'pointer-events-none invisible opacity-0')}>
      {/* the gantry: five columns of two lamps; the lower lamp of each lights red */}
      <div className="flex gap-[clamp(6px,2vw,14px)] rounded-xl border border-white/[.06] bg-[#111316] p-[clamp(8px,2.4vw,16px)] shadow-[0_30px_80px_-30px_rgba(0,0,0,.9)]" aria-hidden>
        {[1, 2, 3, 4, 5].map((n) => (
          <div key={n} className="flex flex-col gap-[clamp(6px,1.6vw,10px)] rounded-lg bg-black/70 p-[clamp(5px,1.4vw,9px)] ring-1 ring-white/[.04]">
            {[0, 1].map((row) => {
              const on = row === 1 && lit >= n;
              return (
                <span key={row}
                  className={cx('block aspect-square w-[clamp(34px,11vw,72px)] rounded-full',
                    on ? 'bg-accent shadow-[0_0_28px_6px_rgba(225,6,0,.55),inset_0_0_10px_rgba(255,255,255,.25)]' : 'bg-[#1d2025] shadow-[inset_0_2px_6px_rgba(0,0,0,.7)]')} />
              );
            })}
          </div>
        ))}
      </div>
      {/* laid out from the start so nothing moves when it appears */}
      <div className={cx('mt-10 text-center transition-[opacity,transform] duration-300', out ? 'opacity-100' : 'translate-y-2 opacity-0')} aria-live="polite">
        <p className="font-display text-[min(56px,14vw)] font-black uppercase leading-none">{out ? 'Lights out' : <span aria-hidden>&nbsp;</span>}</p>
        <p className="mt-2 text-base text-white/80">And away we go.</p>
      </div>
      <div className="absolute right-[max(1rem,env(safe-area-inset-right))] top-[max(1rem,env(safe-area-inset-top))] flex gap-2">
        <button type="button" onClick={toggleSound} aria-pressed={sound} aria-label={sound ? 'Sound on' : 'Sound off'}
          className="grid h-11 w-11 place-items-center rounded-md border border-white/20 text-white transition hover:bg-white/10">
          {sound ? <Volume2 className="h-4 w-4" aria-hidden /> : <VolumeX className="h-4 w-4" aria-hidden />}
        </button>
        <button ref={skip} type="button" onClick={() => finish.current()}
          className="min-h-[44px] rounded-md border border-white/20 px-4 text-sm font-semibold text-white transition hover:bg-white/10">Skip</button>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { user, signIn, expired } = useAuth();
  const nav = useNavigate();
  const reduce = useReducedMotion();
  const [step, setStep] = useState<'email' | 'code' | 'name' | 'out'>('email');
  const [email, setEmail] = useState('');
  const [emailFocused, setEmailFocused] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);
  // a new player's session, held here until they've picked the name others will see
  const pending = useRef<TokenOut | null>(null);
  // the start lights after sign-in; not under reduced motion (no flashing lights)
  const [playLights] = useState(() => !matchMedia('(prefers-reduced-motion: reduce)').matches);
  const audioCtx = useRef<AudioContext | null>(null);
  const arriving = useRef<TokenOut | null>(null);
  const [name, setName] = useState('');

  useEffect(() => {
    if (!cooldown) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);

  // Focus the field on laptops only: on a phone it scrolls past the globe and opens the keyboard.
  const emailRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (step === 'email' || step === 'name') nameRef.current?.focus({ preventScroll: true });
  }, [step]);

  if (user && step !== 'out') return <Navigate to="/" replace />;

  // Browsers (iOS above all) only let a page make sound once a tap has started it. Each tap on
  // the way in (send the code, the code's digits, the name) calls this, so the beeps can play
  // later, after the code has been checked.
  const primeAudio = () => {
    if (!playLights) return;
    try {
      const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      audioCtx.current ??= new AC();
      if (audioCtx.current.state === 'suspended') void audioCtx.current.resume();
    } catch { /* no sound, the lights still run */ }
  };
  const getAudio = useCallback(() => audioCtx.current, []);

  const arrive = (t: TokenOut) => { signIn(t); nav('/', { replace: true }); };
  const enter = async (t: TokenOut) => {
    setStep('out');
    if (playLights) { arriving.current = t; return; } // the lights call arrive() when they go out, or on Skip
    await new Promise((r) => setTimeout(r, 900)); // lights out
    arrive(t);
  };

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    primeAudio();
    // the name is optional here: a returning player can leave it blank to keep the one they have
    const n = tidyName(name);
    if (n && nameProblem(n)) { setError(nameProblem(n)); return; }
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) { setError("That email doesn't look right."); return; }
    setBusy(true); setError(null);
    try {
      await auth.requestCode(email.trim());
      setStep('code'); setCode(''); setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError((err as ApiError).status === 429 ? 'Too many codes requested for this email. Try again in an hour.' : (err as Error).message);
    } finally { setBusy(false); }
  };

  const verify = async (value: string) => {
    setBusy(true); setError(null);
    try {
      const t = await auth.verify(email.trim(), value);
      pending.current = t;
      const n = tidyName(name);
      if (n && n !== t.user.display_name) { await saveAs(t, n); return; }
      if (t.user.display_name) { await enter(t); return; }
      // a new player who left the name blank: ask once more, there's no way in without one
      setStep('name');
    } catch (err) {
      setError((err as Error).message); setCode('');
    } finally { setBusy(false); }
  };

  // Saves the name as this player, then opens the app. If saving fails, the name step says why.
  const saveAs = async (t: TokenOut, n: string) => {
    try {
      tokenStore.set(t.access_token); // signIn follows once the name is in
      const u = await auth.updateMe(n);
      await enter({ ...t, user: u });
    } catch (err) {
      setStep('name');
      setError((err as Error).message);
    }
  };

  const saveName = async (e: FormEvent) => {
    e.preventDefault();
    primeAudio();
    const t = pending.current;
    if (!t) return;
    const n = tidyName(name);
    if (nameProblem(n)) { setError(nameProblem(n)); return; }
    setBusy(true); setError(null);
    await saveAs(t, n);
    setBusy(false);
  };

  const swap = reduce ? {} : {
    initial: { opacity: 0, y: 10 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -10 },
    transition: { duration: 0.25 },
  };

  return (
    <div className="relative isolate min-h-dvh overflow-x-hidden">
      <Backdrop />
      {playLights && (
        <LightsOutSequence show={step === 'out' && !!arriving.current} audio={getAudio}
          onDone={() => { const t = arriving.current; if (t) arrive(t); }} />
      )}

      {/* logo, headline, form and footer share one left edge; the globe balances the right */}
      <div className="mx-auto flex min-h-dvh max-w-7xl flex-col px-5 sm:px-10 lg:px-16">
        <header className="flex items-center gap-4 pt-[max(1.5rem,env(safe-area-inset-top))] sm:pt-8">
          <img src="/cr-logo-white.png" alt="Communitie Racing" width={733} height={224} className="h-9 w-auto sm:h-10" />
          <span className="flex items-center gap-2 text-sm font-semibold text-white/75">
            {/* an F1 car's rear rain light, blinking */}
            <span aria-hidden className="h-1.5 w-3.5 animate-rainlight rounded-[1px] bg-[#FF2A1F] shadow-[0_0_8px_1px_rgba(255,42,31,0.6)]" />
            Quiz League
          </span>
        </header>

        <main className="grid flex-1 content-center items-center gap-8 py-8 land:grid-cols-2 land:gap-8 land:py-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:gap-12 lg:py-8">
          <div className="flex flex-col items-center land:sticky land:top-4 land:order-2 land:self-start lg:order-2">
            <NextRaceGlobe />
          </div>

          <div className="w-full max-w-md land:order-1 lg:order-1">
            <AnimatePresence mode="wait" initial={false}>
              {step === 'email' && (
                <motion.form key="email" {...swap} onSubmit={send} className="space-y-8" noValidate>
                  <div>
                    <RevealHeadline />
                    <p className="mt-5 max-w-[26rem] text-base leading-relaxed text-white/80">Answer a few questions before every Grand Prix. Score after the podium. Climb the Communitie Racing championship.</p>
                  </div>
                  {expired && <p className="rounded-md border border-warn/30 bg-warn/10 px-3 py-2.5 text-sm text-warn">Your session ended. Log in again to carry on.</p>}
                  <div className="space-y-3">
                    <NameField value={name} onChange={(v) => { setName(v); setError(null); }} inputRef={nameRef} invalid={!!error && /name/i.test(error)} enterKeyHint="next" />
                    <label htmlFor="login-email" className="sr-only">Email</label>
                    <div className="relative flex items-center">
                      <Mail aria-hidden className={cx('pointer-events-none absolute left-3.5 h-4 w-4 transition-colors duration-200', emailFocused ? 'text-white' : 'text-white/45')} />
                      <Input ref={emailRef} id="login-email" type="email" inputMode="email" autoComplete="email" enterKeyHint="send"
                        placeholder="Email address" value={email} aria-invalid={!!error && !/name/i.test(error)}
                        onChange={(e) => setEmail(e.target.value)} onFocus={() => setEmailFocused(true)} onBlur={() => setEmailFocused(false)}
                        className="h-12 rounded-md border-white/10 bg-white/[.04] pl-10 pr-3 text-white shadow-none placeholder:text-white/40 focus:bg-white/[.06] focus-visible:border-white/45 focus-visible:ring-0" />
                    </div>
                    {error && <p role="alert" className="text-sm text-accent-hi">{error}</p>}
                    <CardButton type="submit" loading={busy}>Send my code</CardButton>
                    <p className="pt-1 text-sm leading-relaxed text-white/60">Your racing name is what other players see on the leaderboard. Already playing? Leave it blank to keep yours. No password: we email you a 6-digit code.</p>
                  </div>
                </motion.form>
              )}
              {step === 'code' && (
                <motion.div key="code" {...swap} className="space-y-8">
                  <div>
                    <button onClick={() => { setStep('email'); setError(null); }} className="-ml-1 mb-4 flex min-h-[44px] items-center gap-1.5 text-sm text-white/65 transition-colors hover:text-white"><ArrowLeft className="h-4 w-4" />Change email</button>
                    <h1 className="font-display text-[min(44px,11.5vw)] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-6xl land:text-[44px]">Check your email</h1>
                    <p className="mt-5 text-base text-white/80">We sent a 6-digit code to <span className="font-semibold text-white">{email.trim()}</span>.</p>
                    {DEMO && <p className="mt-2 text-sm text-warn">Demo: any 6 digits work. 000000 shows the wrong-code message.</p>}
                  </div>
                  <div className="space-y-3">
                    <OtpInput value={code} disabled={busy} invalid={!!error} onChange={(v) => { primeAudio(); setCode(v); setError(null); if (v.length === 6) void verify(v); }} />
                    {error && <p role="alert" className="text-sm text-accent-hi">{error}</p>}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-white/60">Didn't get it? Check spam.</span>
                      <button disabled={cooldown > 0 || busy} onClick={() => send()} className="num min-h-[44px] font-semibold text-white underline-offset-4 hover:underline disabled:text-white/35 disabled:no-underline">
                        {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
              {step === 'name' && (
                <motion.form key="name" {...swap} onSubmit={saveName} className="space-y-8" noValidate>
                  <div>
                    <h1 className="font-display text-[min(44px,11.5vw)] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-6xl land:text-[44px]">Your racing name</h1>
                    <p className="mt-5 max-w-[26rem] text-base leading-relaxed text-white/80">Pick the name other players will see on the leaderboard. You can change it later in Profile.</p>
                  </div>
                  <div className="space-y-3">
                    <NameField value={name} onChange={(v) => { setName(v); setError(null); }} inputRef={nameRef} invalid={!!error} enterKeyHint="go" />
                    {error && <p role="alert" className="text-sm text-accent-hi">{error}</p>}
                    <CardButton type="submit" loading={busy}>Take my place on the grid</CardButton>
                  </div>
                </motion.form>
              )}
              {step === 'out' && (
                <motion.div key="out" {...swap}>
                  <h1 className="font-display text-[min(44px,11.5vw)] font-black uppercase leading-[0.92] tracking-[0.01em] sm:text-6xl land:text-[44px]">Lights out</h1>
                  <p className="mt-5 text-base text-white/80">And away we go.</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* keeps the form clear of the iPhone home indicator */}
        <div aria-hidden className="pb-[max(1.5rem,env(safe-area-inset-bottom))]" />
      </div>
    </div>
  );
}
