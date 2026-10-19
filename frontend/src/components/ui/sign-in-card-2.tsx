import type { ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion, type HTMLMotionProps } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The submit button from "sign in card 2": a solid red control that presses in on tap
 * and shimmers while loading. (The card shell itself was dropped so the login form can
 * sit directly in the page's racing scene.)
 */

type CardButtonProps = Omit<HTMLMotionProps<'button'>, 'children'> & { children: ReactNode; loading?: boolean };

export function CardButton({ loading, children, className, disabled, ...rest }: CardButtonProps) {
  const reduce = useReducedMotion();
  return (
    <motion.button
      whileTap={reduce ? undefined : { scale: 0.98 }}
      {...rest}
      disabled={loading || disabled}
      className={cn(
        'group/button relative flex h-12 w-full items-center justify-center overflow-hidden rounded-md bg-accent font-semibold text-white transition-colors duration-200 hover:bg-accent-hi disabled:cursor-not-allowed',
        className,
      )}
    >
      <motion.span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/25 to-white/0"
        animate={{ x: ['-100%', '100%'] }}
        transition={{ duration: 1.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
        style={{ opacity: loading ? 1 : 0, transition: 'opacity 0.3s ease' }}
      />
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.span key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex items-center justify-center" role="status" aria-label="Sending">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
          </motion.span>
        ) : (
          <motion.span key="text" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="relative flex items-center justify-center gap-1.5 text-[15px]">
            {children}
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover/button:translate-x-0.5" aria-hidden />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
