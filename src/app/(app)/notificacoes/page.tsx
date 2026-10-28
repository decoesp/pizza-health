import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listNotifications } from "@/lib/data/notifications";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ActionForm } from "@/components/ui/ActionForm";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/actions/notifications";
import { relativeTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Notificações" };
export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ pagina?: string }>;
}) {
  const user = await requireUser("/notificacoes");
  const params = await searchParams;
  const page = Number.parseInt(params.pagina ?? "1", 10) || 1;
  const notifications = await listNotifications(user.id, page);
  const unread = notifications.items.filter((item) => !item.readAt).length;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        eyebrow="Sua conta"
        title="Notificações"
        description="Avisos internos e genéricos. Nenhum valor de exame ou diagnóstico aparece aqui."
        action={
          <form action={markAllNotificationsReadAction}>
            <SubmitButton size="sm" variant="secondary" pendingLabel="Marcando…">
              Marcar todas como lidas
            </SubmitButton>
          </form>
        }
      />

      {unread > 0 ? (
        <p className="mb-4 text-xs text-muted">
          {unread} não lida{unread === 1 ? "" : "s"} nesta página.
        </p>
      ) : null}

      {notifications.items.length === 0 ? (
        <EmptyState
          title="Nada por aqui"
          description="Convites, comentários, desafios e revisões de documentos aparecem nesta caixa."
          icon="bell"
        />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-line">
            {notifications.items.map((item) => (
              <li
                key={item.id}
                className={`flex gap-3 p-4 sm:p-5 ${item.readAt ? "" : "bg-tomato-soft/30"}`}
              >
                {item.actorName ? (
                  <Avatar name={item.actorName} color={item.actorColor ?? "#C2410C"} size={34} />
                ) : (
                  <span className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-full bg-paper-deep text-tomato">
                    <Icon name={item.kind === "achievement" ? "trophy" : item.kind === "challenge" ? "flag" : "bell"} size={16} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold">{item.title}</p>
                    {!item.readAt ? <Badge tone="tomato">nova</Badge> : null}
                  </div>
                  {item.body ? <p className="mt-0.5 text-sm text-muted">{item.body}</p> : null}
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <span className="text-muted">{relativeTime(item.createdAt)}</span>
                    {item.href ? (
                      <Link href={item.href} className="font-semibold text-tomato hover:underline">
                        Abrir
                      </Link>
                    ) : null}
                    {!item.readAt ? (
                      <ActionForm action={markNotificationReadAction} hideMessage>
                        <input type="hidden" name="notificationId" value={item.id} />
                        <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                          Marcar lida
                        </SubmitButton>
                      </ActionForm>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {notifications.pages > 1 ? (
        <nav aria-label="Paginação de notificações" className="mt-5 flex items-center justify-between gap-3">
          <span className="text-xs text-muted">
            Página {notifications.page} de {notifications.pages}
          </span>
          <div className="flex gap-2">
            {notifications.page > 1 ? (
              <Link
                href={`/notificacoes?pagina=${notifications.page - 1}`}
                className="rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-soft"
              >
                Anterior
              </Link>
            ) : null}
            {notifications.page < notifications.pages ? (
              <Link
                href={`/notificacoes?pagina=${notifications.page + 1}`}
                className="rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-soft"
              >
                Próxima
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
