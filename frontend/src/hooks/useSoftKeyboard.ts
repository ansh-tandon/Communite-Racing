import { useEffect } from 'react';

const NOT_TYPED = ['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file', 'image'];

const opensKeyboard = (el: Element | null) =>
  el instanceof HTMLTextAreaElement
  || el instanceof HTMLSelectElement
  || (el instanceof HTMLInputElement && !NOT_TYPED.includes(el.type))
  || (el instanceof HTMLElement && el.isContentEditable);

/**
 * On touch devices, marks <html data-keyboard="open"> while a text field has focus, so
 * the tab bar can slide away and bars pinned above it drop to the screen edge
 * instead of sitting on top of the field (the --tabbar variable in index.css).
 */
export function useSoftKeyboard() {
  useEffect(() => {
    if (!matchMedia('(pointer: coarse)').matches) return;
    const root = document.documentElement;
    let t: number | undefined;
    const onIn = (e: FocusEvent) => {
      if (!opensKeyboard(e.target as Element)) return;
      window.clearTimeout(t);
      root.dataset.keyboard = 'open';
    };
    // a short grace period, so hopping between fields (the OTP boxes) doesn't flicker the bar
    const onOut = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => { if (!opensKeyboard(document.activeElement)) delete root.dataset.keyboard; }, 150);
    };
    document.addEventListener('focusin', onIn);
    document.addEventListener('focusout', onOut);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('focusin', onIn);
      document.removeEventListener('focusout', onOut);
      delete root.dataset.keyboard;
    };
  }, []);
}
