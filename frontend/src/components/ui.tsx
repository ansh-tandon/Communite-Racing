import { createContext, forwardRef, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useBackToClose } from '../hooks/useBackToClose';
import { cn } from '../lib/utils';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

// ---------- Button ----------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-white hover:bg-accent-hi',
  secondary: 'bg-surface2 text-ink border border-line hover:bg-surface3',
  ghost: 'text-muted hover:text-ink hover:bg-surface2',
  danger: 'bg-transparent text-accent-hi border border-accent/40 hover:bg-accent/10',
};
interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> { variant?: Variant; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: LucideIcon; iconRight?: LucideIcon }
export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', size = 'md', loading, icon: Icon, iconRight: IconR, className, children, disabled, ...rest }, ref,
) {
  const sz = size === 'sm' ? 'h-9 px-3.5 text-sm gap-1.5' : size === 'lg' ? 'h-14 px-7 text-base gap-2.5' : 'h-11 px-5 text-[15px] gap-2';
  return (
    <button ref={ref} disabled={disabled || loading}
      // cn, not cx: a caller's className (e.g. px-0) has to win over the size's padding
      className={cn('inline-flex items-center justify-center rounded-md font-semibold transition-[background,transform,color] duration-150 active:scale-[.97] disabled:opacity-50 disabled:pointer-events-none select-none', sz, VARIANT[variant], className)}
      {...rest}>
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : Icon && <Icon className="h-[18px] w-[18px]" aria-hidden />}
      {children}
      {IconR && !loading && <IconR className="h-[18px] w-[18px]" aria-hidden />}
    </button>
  );
});

// ---------- Badge ----------
type Tone = 'red' | 'green' | 'amber' | 'grey' | 'white';
const TONE: Record<Tone, string> = {
  red: 'bg-accent/15 text-[#FF5A52] border-accent/30',
  green: 'bg-ok/12 text-ok border-ok/30',
  amber: 'bg-warn/12 text-warn border-warn/30',
  grey: 'bg-surface2 text-muted border-line',
  white: 'bg-ink text-bg border-ink',
};
export function Badge({ tone = 'grey', dot, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 font-display text-[13px] font-semibold uppercase tracking-[0.08em]', TONE[tone], className)}>
      {dot && <span className={cx('h-1.5 w-1.5 rounded-full', tone === 'green' ? 'bg-ok animate-pulse' : 'bg-current')} />}
      {children}
    </span>
  );
}

// ---------- Section heading ----------
export function SectionTitle({ kicker, title, action }: { kicker?: string; title: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        {kicker && <p className="sector mb-1">{kicker}</p>}
        <h2 className="font-display text-2xl font-bold uppercase leading-none tracking-wide sm:text-[28px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

// ---------- States ----------
export const Skeleton = ({ className }: { className?: string }) => <div className={cx('skeleton', className)} aria-hidden />;

export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-line px-6 py-10 text-center">
      <span className="mb-4 grid h-12 w-12 place-items-center rounded-full bg-surface2 text-muted"><Icon className="h-6 w-6" aria-hidden /></span>
      <p className="font-semibold">{title}</p>
      {body && <p className="mt-1.5 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent/[.06] p-4">
      <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-accent-hi" aria-hidden />
      <div className="flex-1 text-sm">
        <p className="font-semibold">Couldn't load this.</p>
        <p className="text-muted">{(error as Error)?.message ?? 'Something went wrong.'}</p>
      </div>
      {onRetry && <Button size="sm" variant="secondary" icon={RefreshCw} onClick={onRetry}>Retry</Button>}
    </div>
  );
}

// ---------- Confirmation dialog ----------
export function ConfirmationDialog({ open, title, body, confirmLabel, tone = 'primary', loading, onConfirm, onClose, children }: {
  open: boolean; title: string; body?: ReactNode; confirmLabel: string; tone?: 'primary' | 'danger'; loading?: boolean;
  onConfirm: () => void; onClose: () => void; children?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useBackToClose(open, onClose); // Android back closes the dialog, not the page
  useEffect(() => {
    const d = ref.current; if (!d) return;
    if (open && !d.open) d.showModal(); else if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} onClose={onClose} onCancel={onClose}
      className="w-[min(92vw,460px)] rounded-2xl border border-line bg-surface p-0 text-ink shadow-lift backdrop:bg-black/70 backdrop:backdrop-blur-sm">
      <div className="p-6">
        <div className="mb-3 flex items-start justify-between gap-4">
          <h2 className="font-display text-2xl font-bold uppercase leading-tight">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-1 text-muted hover:text-ink" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {body && <div className="text-[15px] leading-relaxed text-muted">{body}</div>}
        {children}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant={tone === 'danger' ? 'danger' : 'primary'} loading={loading} onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </dialog>
  );
}

// ---------- Toasts ----------
interface Toast { id: number; kind: 'ok' | 'error'; text: string }
const ToastCtx = createContext<(kind: Toast['kind'], text: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const push = useCallback((kind: Toast['kind'], text: string) => {
    const id = Date.now() + Math.random();
    setItems((t) => [...t, { id, kind, text }]);
    setTimeout(() => setItems((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(var(--tabbar)+0.75rem)] z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto flex max-w-md animate-rise items-center gap-2.5 rounded-xl border border-line bg-surface2 px-4 py-3 text-sm shadow-lift">
            {t.kind === 'ok' ? <CheckCircle2 className="h-5 w-5 text-ok" aria-hidden /> : <AlertTriangle className="h-5 w-5 text-accent-hi" aria-hidden />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Avatar ----------
export function Avatar({ name, me, size = 36 }: { name: string; me?: boolean; size?: number }) {
  const ini = name.split(/\s+/).map((p) => p[0]).join('').slice(0, 2).toUpperCase();
  return (
    <span style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cx('grid shrink-0 place-items-center rounded-full font-display font-bold', me ? 'bg-accent text-white' : 'bg-surface3 text-ink/90')}>
      {ini}
    </span>
  );
}
