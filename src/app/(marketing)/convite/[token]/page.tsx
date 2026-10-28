import type { Metadata } from "next";
import Link from "next/link";
import { hashToken } from "@/lib/auth/password";
import { isExpired } from "@/lib/domain/dates";
import { queryOne } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { joinByInviteAction } from "@/actions/communities";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ButtonLink } from "@/components/ui/Button";
import { Badge, Card, Notice } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";

export const metadata: Metadata = { title: "Convite" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await getCurrentUser();
  const invite = token
    ? await queryOne<{
        id: string;
        slug: string;
        name: string;
        description: string;
        invite_expires_at: string | null;
        created_by: string;
      }>(
        "SELECT id, slug, name, description, invite_expires_at, created_by FROM communities WHERE invite_token_hash = ? AND archived_at IS NULL LIMIT 1",
        [hashToken(token)],
      )
    : null;

  const expired = isExpired(invite?.invite_expires_at);
  const members = invite
    ? await queryOne<{ total: unknown }>(
        "SELECT COUNT(*) AS total FROM community_members WHERE community_id = ?",
        [invite.id],
      )
    : null;
  const next = `/convite/${token}`;

  return (
    <div className="container-page max-w-2xl py-12 lg:py-20">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Convite de comunidade
      </p>
      <h1 className="mt-3 text-3xl font-semibold">
        {invite && !expired ? `Você foi convidado para ${invite.name}` : "Convite indisponível"}
      </h1>

      {!invite || expired ? (
        <div className="mt-6">
          <Notice tone="error">
            {expired
              ? "Este convite expirou. Peça um novo link a quem administra a comunidade."
              : "Este convite não existe ou foi revogado."}
          </Notice>
          <p className="mt-5 text-sm">
            <Link href="/" className="font-semibold text-tomato hover:underline">
              Voltar para o início
            </Link>
          </p>
        </div>
      ) : (
        <Card className="mt-6 p-6">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="basil">
              <Icon name="users" size={12} />
              {Number(members?.total ?? 0)} membros
            </Badge>
            <Badge tone="neutral">
              <Icon name="lock" size={12} />
              acesso por convite
            </Badge>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-soft">
            {invite.description || "Uma comunidade privada para cuidar junto."}
          </p>

          <div className="mt-6 rounded-xl border border-line bg-surface-soft p-4 text-sm text-muted">
            Entrar na comunidade não dá acesso automático aos exames, vacinas ou
            hábitos de ninguém. Cada pessoa escolhe o que compartilhar.
          </div>

          <div className="mt-6">
            {user ? (
              <ActionForm action={joinByInviteAction}>
                <input type="hidden" name="token" value={token} />
                <SubmitButton pendingLabel="Entrando…">
                  Entrar em {invite.name}
                </SubmitButton>
              </ActionForm>
            ) : (
              <div className="flex flex-wrap gap-3">
                <ButtonLink href={`/entrar?next=${encodeURIComponent(next)}`}>
                  Entrar e aceitar
                </ButtonLink>
                <ButtonLink
                  href={`/criar-conta?next=${encodeURIComponent(next)}`}
                  variant="secondary"
                >
                  Criar conta
                </ButtonLink>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
