// shadcn "navbar-02": logo, pill links beside it, actions on the right. Adapted for the app:
// links are React Router links (the current page gets data-active), and the right side takes
// whatever the app passes (the account menu). There's no Sign in/Sign up or theme toggle,
// because the bar only shows to signed-in players and the app is dark only. Phones use the
// bottom tab bar instead of a menu sheet, so the links hide below md.
import type { ComponentProps, ReactNode } from 'react';
import { Link, useMatch } from 'react-router-dom';
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from '@/components/ui/navigation-menu';
import { cn } from '@/lib/utils';

export interface NavItem { to: string; label: string; end?: boolean }

function NavMenuItem({ to, label, end }: NavItem) {
  const active = !!useMatch({ path: to, end: !!end });
  return (
    <NavigationMenuItem>
      <NavigationMenuLink asChild active={active} className={navigationMenuTriggerStyle()}>
        <Link to={to} aria-current={active ? 'page' : undefined}>{label}</Link>
      </NavigationMenuLink>
    </NavigationMenuItem>
  );
}

export const NavMenu = ({ items, ...props }: ComponentProps<typeof NavigationMenu> & { items: NavItem[] }) => (
  <NavigationMenu aria-label="Main" {...props}>
    <NavigationMenuList className="data-[orientation=vertical]:-ms-2 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-start data-[orientation=vertical]:justify-start">
      {items.map((i) => <NavMenuItem key={i.to} {...i} />)}
    </NavigationMenuList>
  </NavigationMenu>
);

const Navbar = ({ logo, items, actions, className }: { logo: ReactNode; items: NavItem[]; actions?: ReactNode; className?: string }) => {
  return (
    <header className={cn('h-16 border-b border-line bg-bg', className)}>
      <div className="px-safe mx-auto flex h-full max-w-7xl items-center justify-between">
        <div className="flex items-center gap-12">
          {logo}

          {/* Desktop Menu */}
          <NavMenu items={items} className="hidden md:flex" />
        </div>

        <div className="flex items-center gap-3">{actions}</div>
      </div>
    </header>
  );
};

export default Navbar;
