import type { ReactNode } from "react";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { unreadNotificationCount } from "@/lib/data/notifications";
import { logoutAction } from "@/actions/auth";
import { Logo } from "@/components/layout/Logo";
import { NavLinks, MobileTabBar, type NavItem } from "@/components/layout/NavLinks";
import { Avatar, Badge } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { Footer } from "@/components/layout/Footer";

export const dynamic = "force-dynamic";

const NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: "home" },
  { href: "/comunidade", label: "Comunidade", icon: "users" },
  { href: "/habitos", label: "Hábitos", icon: "activity" },
  { href: "/exames", label: "Exames", icon: "file" },
  { href: "/vacinas", label: "Vacinas", icon: "shield" },
  { href: "/desafios", label: "Desafios", icon: "flag" },
  { href: "/ranking", label: "Ranking", icon: "trophy" },
];

const MOBILE_NAV: NavItem[] = [
  { href: "/inicio", label: "Início", icon: "home" },
  { href: "/comunidade", label: "Comunidade", icon: "users" },
  { href: "/habitos", label: "Hábitos", icon: "activity" },
  { href: "/exames", label: "Exames", icon: "file" },
  { href: "/perfil", label: "Perfil", icon: "user" },
];

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await requireUser();
  const [communities, unread] = await Promise.all([
    listCommunitiesForUser(user.id),
    unreadNotificationCount(user.id),
  ]);

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden border-r border-line bg-surface/80 md:flex md:min-h-dvh md:flex-col md:sticky md:top-0 md:h-dvh">
        <div className="px-5 py-6">
          <Logo />
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-4">
          <NavLinks items={NAV} />

          <div className="mt-6 border-t border-line pt-4">
            <p className="px-3 text-[0.65rem] font-bold tracking-[0.16em] text-muted uppercase">
              Minhas comunidades
            </p>
            <div className="mt-2 space-y-0.5">
              {communities.slice(0, 5).map((community) => (
                <Link
                  key={community.id}
                  href={`/comunidade/${community.slug}`}
                  className="flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm text-ink-soft hover:bg-paper-deep"
                >
                  <span className="truncate">{community.name}</span>
                  <span className="text-[0.65rem] text-muted">{community.memberCount}</span>
                </Link>
              ))}
              <Link
                href="/comunidade"
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-tomato hover:bg-tomato-soft"
              >
                <Icon name="plus" size={14} />
                Ver todas / criar
              </Link>
            </div>
          </div>
        </div>

        <div className="border-t border-line p-3">
          <Link
            href="/notificacoes"
            className="mb-2 flex items-center justify-between rounded-xl px-3 py-2 text-sm text-ink-soft hover:bg-paper-deep"
          >
            <span className="flex items-center gap-2">
              <Icon name="bell" size={17} />
              Notificações
            </span>
            {unread > 0 ? <Badge tone="tomato">{unread}</Badge> : null}
          </Link>
          <Link
            href="/perfil"
            className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-paper-deep"
          >
            <Avatar name={user.name} color={user.avatarColor} size={34} />
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user.name}</span>
              <span className="block truncate text-xs text-muted">{user.email}</span>
            </span>
          </Link>
          <form action={logoutAction} className="mt-1">
            <button
              type="submit"
              className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-xs font-medium text-muted hover:bg-paper-deep hover:text-tomato"
            >
              <Icon name="logout" size={15} />
              Sair
            </button>
          </form>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur md:hidden">
          <Logo />
          <div className="flex items-center gap-2">
            <Link
              href="/notificacoes"
              aria-label={`Notificações${unread > 0 ? `, ${unread} não lidas` : ""}`}
              className="relative rounded-full border border-line bg-surface p-2 text-ink-soft"
            >
              <Icon name="bell" size={19} />
              {unread > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-tomato px-1 text-[0.55rem] font-bold text-white">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <Link href="/perfil" aria-label="Seu perfil">
              <Avatar name={user.name} color={user.avatarColor} size={34} />
            </Link>
          </div>
        </header>

        <main id="conteudo" className="flex-1 pb-24 md:pb-0">
          <div className="container-page py-6 md:py-10">{children}</div>
        </main>

        <div className="hidden md:block">
          <Footer />
        </div>
      </div>

      <MobileTabBar items={MOBILE_NAV} />
    </div>
  );
}
