import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Home, LogOut, Shield, Trophy, User, Zap } from 'lucide-react';
import { DEMO } from '../api/client';
import { resetDemo } from '../demo/demoApi';
import { useAuth } from '../hooks/useAuth';
import { useBackToClose } from '../hooks/useBackToClose';
import { useSoftKeyboard } from '../hooks/useSoftKeyboard';
import { Avatar, cx } from './ui';
import Navbar from './ui/navbar-02';

const NAV = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/quiz', label: 'Quiz', icon: Zap },
  { to: '/standings', label: 'Leaderboard', icon: Trophy },
];

export function Logo({ compact }: { compact?: boolean }) {
  return (
    <Link to="/" className="flex min-h-[44px] items-center gap-2.5" aria-label="Communitie Racing Quiz League, home">
      <img src="/cr-logo-white.png" alt="" width={733} height={224} className={compact ? 'h-7 w-auto' : 'h-8 w-auto'} />
    </Link>
  );
}

function AccountMenu() {
  const { user, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const nav = useNavigate();
  useBackToClose(open, () => setOpen(false));
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', close); document.removeEventListener('keydown', onKey); };
  }, [open]);
  if (!user) return null;
  const name = user.display_name ?? user.email;
  // replace: the open menu added a history entry (useBackToClose); going somewhere swaps it out
  const go = (to: string) => { setOpen(false); nav(to, { replace: true }); };
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu"
        className="flex min-h-[44px] items-center gap-2.5 rounded-full border border-line bg-surface py-1 pl-1 pr-3 text-sm font-semibold transition-colors hover:bg-surface2 active:bg-surface2">
        <Avatar name={name} me size={30} />
        <span className="hidden max-w-[140px] truncate sm:inline">{user.display_name ?? 'Set your name'}</span>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-[52px] z-50 w-60 animate-rise overflow-hidden rounded-lg border border-line bg-surface2 p-1.5 shadow-lift">
          <p className="truncate px-3 pb-2 pt-1.5 text-[13px] text-muted">{user.email}</p>
          <MenuItem icon={User} onClick={() => go('/profile')}>Profile</MenuItem>
          {user.is_admin && <MenuItem icon={Shield} onClick={() => go('/admin')}>Admin</MenuItem>}
          <MenuItem icon={LogOut} onClick={() => { signOut(); go('/login'); }}>Sign out</MenuItem>
        </div>
      )}
    </div>
  );
}
function MenuItem({ icon: Icon, children, onClick }: { icon: typeof User; children: string; onClick: () => void }) {
  return (
    <button role="menuitem" onClick={onClick} className="flex min-h-[44px] w-full items-center gap-2.5 rounded-md px-3 text-left text-[15px] font-medium hover:bg-surface3 active:bg-surface3">
      <Icon className="h-4 w-4 text-muted" aria-hidden />{children}
    </button>
  );
}

function DemoBanner() {
  if (!DEMO) return null;
  return (
    <div className="border-b border-warn/20 bg-warn/[.07] px-4 py-1.5 text-center text-[13px] text-warn">
      Demo mode: sample players, answers and results.{' '}
      <button className="underline underline-offset-2" onClick={() => { resetDemo(); location.reload(); }}>Reset demo</button>
    </div>
  );
}

export function AppShell() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  useSoftKeyboard();
  return (
    // the page leaves room for the phone tab bar (--tabbar: 0 on laptops and while typing)
    <div className="min-h-dvh pb-[var(--tabbar)]">
      {/* one sticky block that starts below the iPhone status bar / notch; a phone held sideways
          is too short to keep it pinned, so there it scrolls away with the page */}
      <div className="sticky top-0 z-40 bg-bg pt-[env(safe-area-inset-top)] [@media(max-height:500px)]:static">
        <DemoBanner />
        <Navbar logo={<Logo />} items={NAV} actions={<AccountMenu />} />
      </div>
      <main className="px-safe mx-auto max-w-7xl pb-16 pt-5 sm:pt-8">
        <Outlet />
      </main>
      {/* phone tab bar: thumb-height targets, clears the home indicator, slides away while typing */}
      <nav aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 grid h-[calc(64px+env(safe-area-inset-bottom))] grid-cols-3 border-t border-line bg-bg pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] transition-transform duration-200 md:hidden [html[data-keyboard=open]_&]:translate-y-full">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end}
            className={({ isActive }) => cx('relative flex flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors active:bg-white/[.04]', isActive ? 'text-ink' : 'text-muted')}>
            {({ isActive }) => (<>
              {isActive && <span className="absolute top-0 h-[2px] w-8 bg-accent" />}
              <n.icon className={cx('h-[22px] w-[22px]', isActive && 'text-accent-hi')} aria-hidden />
              {n.label}
            </>)}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

/** The five start lights. `lit` 0–5; `size` in px. */
export function StartLights({ lit, size = 22, className }: { lit: number; size?: number; className?: string }) {
  return (
    <div className={cx('flex gap-2', className)} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => (
        <span key={i} className="flex flex-col gap-1.5 rounded-full bg-black/60 p-1.5 ring-1 ring-white/5">
          {[0, 1].map((j) => (
            <span key={j} style={{ width: size, height: size }}
              className={cx('rounded-full transition-colors duration-150', i < lit && j === 1 ? 'animate-lamp bg-accent shadow-[0_0_14px_rgba(225,6,0,.75)]' : 'bg-[#24262b]')} />
          ))}
        </span>
      ))}
    </div>
  );
}
