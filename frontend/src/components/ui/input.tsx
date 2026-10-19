import { forwardRef, type ComponentProps } from 'react';
import { cn } from '@/lib/utils';

/** shadcn's Input, mapped onto this app's colour tokens (and forwardRef, for React 18). */
export const Input = forwardRef<HTMLInputElement, ComponentProps<'input'>>(function Input({ className, type, ...props }, ref) {
  return (
    <input
      ref={ref}
      type={type}
      data-slot="input"
      className={cn(
        // text-base on phones: iOS zooms into any input smaller than 16px
        'flex h-9 w-full min-w-0 rounded-md border border-line bg-transparent px-3 py-1 text-base shadow-sm outline-none transition-[color,box-shadow] placeholder:text-muted selection:bg-accent selection:text-white disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
        'focus-visible:border-white/40 focus-visible:ring-[3px] focus-visible:ring-white/10',
        'aria-[invalid=true]:border-accent aria-[invalid=true]:ring-accent/20',
        className,
      )}
      {...props}
    />
  );
});
