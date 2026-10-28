import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCommunityBySlug, listMembers } from "@/lib/data/communities";
import { isManager, membershipFor } from "@/lib/authz";
import { Avatar, Badge, Card, EmptyState, PageHeader } from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  leaveCommunityAction,
  promoteMemberAction,
  removeMemberAction,
} from "@/actions/communities";
import { formatDate } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Membros" };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "proprietário", admin: "administrador", member: "membro" } as const;

export default async function MembersPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser("/comunidade");
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();
  const membership = await membershipFor(user.id, community.id);
  if (!membership) notFound();
  const members = await listMembers(community.id);
  const canManage = isManager(membership.role);

  return (
    <div>
      <PageHeader
        eyebrow={community.name}
        title="Membros"
        description="Papéis administrativos moderam a convivência. Eles não recebem acesso aos dados clínicos de ninguém."
        action={
          <Link href={`/comunidade/${community.slug}`} className="text-sm font-semibold text-tomato hover:underline">
            Voltar ao feed
          </Link>
        }
      />

      <Card className="overflow-hidden">
        <ul className="divide-y divide-line">
          {members.map((member) => {
            const self = member.userId === user.id;
            return (
              <li key={member.userId} className="flex flex-wrap items-center gap-3 p-4 sm:p-5">
                <Avatar name={member.name} color={member.avatarColor} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    {member.name}
                    {self ? <span className="text-xs font-normal text-muted">(você)</span> : null}
                    <Badge tone={member.role === "owner" ? "saffron" : member.role === "admin" ? "tomato" : "neutral"}>
                      {ROLE_LABEL[member.role]}
                    </Badge>
                  </p>
                  <p className="text-xs text-muted">
                    {member.city ? `${member.city} · ` : ""}entrou em {formatDate(member.joinedAt.slice(0, 10))}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link
                    href={`/comunidade/${community.slug}/membros/${member.userId}`}
                    className="rounded-full border border-line bg-surface px-3 py-1.5 text-xs font-semibold hover:bg-surface-soft"
                  >
                    Ver perfil
                  </Link>
                  {canManage && !self && member.role !== "owner" ? (
                    <>
                      <ActionForm action={promoteMemberAction} hideMessage>
                        <input type="hidden" name="communityId" value={community.id} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <input type="hidden" name="role" value={member.role === "admin" ? "member" : "admin"} />
                        <SubmitButton size="sm" variant="ghost" pendingLabel="…">
                          {member.role === "admin" ? "Remover admin" : "Tornar admin"}
                        </SubmitButton>
                      </ActionForm>
                      <ActionForm action={removeMemberAction} hideMessage>
                        <input type="hidden" name="communityId" value={community.id} />
                        <input type="hidden" name="userId" value={member.userId} />
                        <ConfirmButton
                          message={`Remover ${member.name} da comunidade?`}
                          variant="ghost"
                          size="sm"
                        >
                          Remover
                        </ConfirmButton>
                      </ActionForm>
                    </>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      </Card>

      {members.length === 0 ? (
        <EmptyState title="Nenhum membro" description="Convide alguém de confiança." icon="users" />
      ) : null}

      <Card className="mt-6 p-5">
        <h2 className="text-base font-semibold">Sair da comunidade</h2>
        <p className="mt-1 text-sm text-muted">
          Se você for proprietário e houver outras pessoas, transfira a posse na
          página de dados ou remova os membros antes de sair. Comunidades sem
          membros são arquivadas.
        </p>
        <div className="mt-3">
          <ActionForm action={leaveCommunityAction} hideMessage>
            <input type="hidden" name="communityId" value={community.id} />
            <ConfirmButton
              message="Sair desta comunidade? Seus registros privados continuam na sua conta."
              variant="secondary"
              size="sm"
            >
              Sair da comunidade
            </ConfirmButton>
          </ActionForm>
        </div>
      </Card>

      <p className="mt-4 flex items-center gap-2 text-xs text-muted">
        <Icon name="lock" size={14} />
        O acesso é verificado no servidor em cada requisição. Um link de comunidade
        não funciona para quem não é membro.
      </p>
    </div>
  );
}
