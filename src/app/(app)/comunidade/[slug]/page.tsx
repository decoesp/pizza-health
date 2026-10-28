import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCommunityBySlug, listMembers } from "@/lib/data/communities";
import { membershipFor } from "@/lib/authz";
import { listChallenges, computeProgress } from "@/lib/data/challenges";
import { listCommentsForPosts, listFeed } from "@/lib/data/feed";
import {
  Avatar,
  Badge,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Select,
  Textarea,
} from "@/components/ui/Primitives";
import { Icon } from "@/components/ui/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { PostCard } from "@/components/community/PostCard";
import { createPostAction } from "@/actions/posts";
import {
  regenerateInviteAction,
  revokeInviteAction,
  updateCommunityAction,
} from "@/actions/communities";
import { formatDate, formatDateTime, todayIso } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Comunidade" };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "proprietário", admin: "administrador", member: "membro" } as const;

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ pagina?: string }>;
}) {
  const user = await requireUser("/comunidade");
  const { slug } = await params;
  const query = await searchParams;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();
  const membership = await membershipFor(user.id, community.id);
  if (!membership) notFound();
  const page = Number.parseInt(query.pagina ?? "1", 10) || 1;

  const [feed, members, challenges] = await Promise.all([
    listFeed(community.id, user.id, page),
    listMembers(community.id),
    listChallenges(community.id, user.id),
  ]);
  const comments = await listCommentsForPosts(feed.posts.map((post) => post.id));
  const canManage = membership.role === "owner" || membership.role === "admin";
  const activeChallenges = challenges
    .filter((challenge) => challenge.status === "active" && challenge.endsOn >= todayIso())
    .slice(0, 3);
  const challengeProgress = [];
  for (const challenge of activeChallenges) {
    challengeProgress.push({ challenge, progress: await computeProgress(challenge, user.id) });
  }

  return (
    <div>
      <PageHeader
        eyebrow="Comunidade privada"
        title={community.name}
        description={community.description || "Um espaço privado para cuidar junto."}
        action={
          <div className="flex flex-wrap gap-2">
            <Badge tone={canManage ? "saffron" : "neutral"}>
              {ROLE_LABEL[membership.role]}
            </Badge>
            <Badge tone="basil">
              <Icon name="users" size={12} />
              {members.length} membro{members.length === 1 ? "" : "s"}
            </Badge>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <Card className="p-5">
            <div className="mb-3 flex items-center gap-3">
              <Avatar name={user.name} color={user.avatarColor} size={38} />
              <div>
                <h2 className="text-base font-semibold">Compartilhar com a turma</h2>
                <p className="text-xs text-muted">
                  Nada de resultados de exame ou diagnóstico aqui. Só o que você escrever.
                </p>
              </div>
            </div>
            <ActionForm action={createPostAction} className="space-y-3" resetOnSuccess>
              <input type="hidden" name="communityId" value={community.id} />
              <Field label="Publicação" htmlFor="post-body">
                <Textarea
                  id="post-body"
                  name="body"
                  required
                  minLength={2}
                  maxLength={1200}
                  rows={3}
                  placeholder="Como está seu dia? Um incentivo para alguém?"
                />
              </Field>
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-44 flex-1">
                  <Field label="Visibilidade" htmlFor="post-visibility">
                    <Select id="post-visibility" name="visibility" defaultValue="community">
                      <option value="community">Toda a comunidade</option>
                      <option value="private">Só para mim</option>
                    </Select>
                  </Field>
                </div>
                <label className="flex items-center gap-2 rounded-xl border border-line bg-surface-soft px-3 py-2.5 text-xs font-medium">
                  <input type="checkbox" name="milestone" className="h-4 w-4 accent-[#d9552f]" />
                  Marcar como conquista
                </label>
                <SubmitButton pendingLabel="Publicando…">Publicar</SubmitButton>
              </div>
            </ActionForm>
          </Card>

          {feed.posts.length === 0 ? (
            <EmptyState
              title="O feed está começando"
              description="A primeira publicação pode ser um incentivo curto, uma meta da semana ou um check-up marcado."
              icon="users"
            />
          ) : (
            <div className="space-y-4">
              {feed.posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  comments={comments[post.id] ?? []}
                  communitySlug={community.slug}
                  viewerId={user.id}
                  canModerate={canManage}
                />
              ))}
            </div>
          )}

          {feed.pages > 1 ? (
            <nav aria-label="Paginação do feed" className="flex items-center justify-between gap-3">
              <span className="text-xs text-muted">
                Página {feed.page} de {feed.pages} · {feed.total} publicações
              </span>
              <div className="flex gap-2">
                {feed.page > 1 ? (
                  <Link
                    href={`/comunidade/${community.slug}?pagina=${feed.page - 1}`}
                    className="rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-soft"
                  >
                    Anterior
                  </Link>
                ) : null}
                {feed.page < feed.pages ? (
                  <Link
                    href={`/comunidade/${community.slug}?pagina=${feed.page + 1}`}
                    className="rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-soft"
                  >
                    Próxima
                  </Link>
                ) : null}
              </div>
            </nav>
          ) : null}
        </div>

        <aside className="space-y-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Membros</h2>
              <Link href={`/comunidade/${community.slug}/membros`} className="text-xs font-semibold text-tomato hover:underline">
                Ver todos
              </Link>
            </div>
            <ul className="mt-3 space-y-2.5">
              {members.slice(0, 5).map((member) => (
                <li key={member.userId}>
                  <Link
                    href={`/comunidade/${community.slug}/membros/${member.userId}`}
                    className="flex items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-surface-soft"
                  >
                    <Avatar name={member.name} color={member.avatarColor} size={30} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{member.name}</span>
                      <span className="block text-[0.65rem] text-muted">{ROLE_LABEL[member.role]}</span>
                    </span>
                    <Icon name="chevron-right" size={14} className="text-muted" />
                  </Link>
                </li>
              ))}
            </ul>
            {members.length > 5 ? (
              <p className="mt-2 text-xs text-muted">e mais {members.length - 5} pessoa{members.length - 5 === 1 ? "" : "s"}.</p>
            ) : null}
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">Desafios</h2>
              <Link href="/desafios" className="text-xs font-semibold text-tomato hover:underline">
                Todos
              </Link>
            </div>
            {challengeProgress.length === 0 ? (
              <p className="mt-3 text-sm text-muted">Nenhum desafio ativo agora.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {challengeProgress.map(({ challenge, progress }) => (
                  <li key={challenge.id}>
                    <Link href={`/desafios/${challenge.id}`} className="text-sm font-semibold hover:text-tomato">
                      {challenge.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {challenge.kind === "collective" ? "em time" : "individual"} · até {formatDate(challenge.endsOn)}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-ink-soft">
                      {Math.round(progress.value)} / {progress.target}
                    </p>
                  </li>
                ))}
              </ul>
            )}
            {canManage ? (
              <p className="mt-3 text-xs text-muted">
                Como administrador, você pode criar desafios na página{" "}
                <Link href="/desafios" className="underline">
                  Desafios
                </Link>
                .
              </p>
            ) : null}
          </Card>

          {canManage ? (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Convite</h2>
              <p className="mt-1 text-xs text-muted">
                Link de uso único por 7 dias. Revogar invalida o anterior.
              </p>
              <div className="mt-3 space-y-2">
                <ActionForm action={regenerateInviteAction}>
                  <input type="hidden" name="communityId" value={community.id} />
                  <SubmitButton size="sm" pendingLabel="Gerando…">
                    Gerar novo link
                  </SubmitButton>
                </ActionForm>
                {community.hasInvite ? (
                  <>
                    <p className="text-xs text-muted">
                      Convite ativo{community.inviteExpiresAt ? ` até ${formatDateTime(community.inviteExpiresAt)}` : ""}.
                    </p>
                    <ActionForm action={revokeInviteAction} hideMessage>
                      <input type="hidden" name="communityId" value={community.id} />
                      <ConfirmButton message="Revogar o convite ativo? O link deixa de funcionar." variant="ghost" size="sm">
                        Revogar convite
                      </ConfirmButton>
                    </ActionForm>
                  </>
                ) : (
                  <p className="text-xs text-muted">Nenhum convite ativo.</p>
                )}
              </div>
              <details className="mt-4 border-t border-line pt-3">
                <summary className="cursor-pointer text-sm font-semibold text-tomato-deep">
                  Editar comunidade
                </summary>
                <ActionForm action={updateCommunityAction} className="mt-3 space-y-2">
                  <input type="hidden" name="communityId" value={community.id} />
                  <Field label="Nome" htmlFor="edit-name">
                    <Input id="edit-name" name="name" defaultValue={community.name} required maxLength={80} />
                  </Field>
                  <Field label="Descrição" htmlFor="edit-description">
                    <Textarea id="edit-description" name="description" defaultValue={community.description} maxLength={280} rows={2} />
                  </Field>
                  <SubmitButton size="sm" variant="secondary" pendingLabel="Salvando…">
                    Salvar
                  </SubmitButton>
                </ActionForm>
              </details>
              <Link
                href={`/comunidade/${community.slug}/moderacao`}
                className="mt-4 block text-xs font-semibold text-tomato hover:underline"
              >
                Abrir moderação e denúncias
              </Link>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="text-base font-semibold">Privacidade do grupo</h2>
              <p className="mt-2 text-xs leading-relaxed text-muted">
                Administradores moderam publicações, mas não recebem acesso aos
                documentos médicos dos membros. Cada pessoa controla o que
                compartilhar.
              </p>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
