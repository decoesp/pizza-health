"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/Icon";

export type NavItem = { href: string; label: string; icon: IconName };

export function isNavActive(pathname: string, href: string): boolean {
  if (href === "/inicio") return pathname === "/inicio";
  if (href === "/perfil") return pathname.startsWith("/perfil");
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLinks({
  items,
  variant = "sidebar",
}: {
  items: NavItem[];
  variant?: "sidebar" | "tabs";
}) {
  const pathname = usePathname();
  if (variant === "tabs") {
    return (
      <nav aria-label="Navegação principal" className="flex gap-1 overflow-x-auto pb-1">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`inline-flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-xs font-semibold transition-colors ${
                active
                  ? "bg-tomato text-white"
                  : "bg-surface text-ink-soft hover:bg-paper-deep"
              }`}
            >
              <Icon name={item.icon} size={15} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <nav aria-label="Navegação principal" className="space-y-1">
      {items.map((item) => {
        const active = isNavActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
              active
                ? "bg-tomato-soft text-tomato-deep"
                : "text-ink-soft hover:bg-paper-deep"
            }`}
          >
            <Icon name={item.icon} size={18} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 backdrop-blur md:hidden"
    >
      <div className="grid grid-cols-5">
        {items.map((item) => {
          const active = isNavActive(pathname, item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex flex-col items-center gap-1 px-1 py-2.5 text-[0.62rem] font-semibold ${
                active ? "text-tomato" : "text-muted"
              }`}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
