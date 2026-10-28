import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { PageHeader, Card, Badge, EmptyState, Field, Input, Textarea } from "@/components/ui/Primitives";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { createCommunityAction } from "@/actions/communities";
import { formatDate } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Comunidades" };
export const dynamic = "force-dynamic";

const ROLE_LABEL = { owner: "proprietário", admin: "administrador", member: "membro" } as const;

export default async function CommunitiesPage() {
  const user = await requireUser("/comunidade");
  const communities = await listCommunitiesForUser(user.id);

  return (
    <div>
      <PageHeader
        eyebrow="Minha comunidade"
        title="Comunidades"
        description="Grupos privados por convite. Estar perto não significa ver os exames de ninguém."
        action={
          <ButtonLink href="/desafios" variant="secondary" size="sm">
            <Icon name="flag" size={15} />
            Desafios
          </ButtonLink>
        }
      />

      {communities.length === 0 ? (
        <EmptyState
          title="Você ainda não está em uma comunidade"
          description="Crie uma comunidade ou peça um link de convite a alguém de confiança."
          icon="users"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {communities.map((community) => (
            <Card key={community.id} className="flex flex-col p-5">
              <div className="flex items-start justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-tomato-soft text-tomato">
                  <Icon name="users" size={21} />
                </span>
                <Badge tone={community.role === "member" ? "neutral" : "saffron"}>
                  {ROLE_LABEL[community.role]}
                </Badge>
              </div>
              <h2 className="mt-3 text-lg font-semibold">{community.name}</h2>
              <p className="mt-1 line-clamp-3 flex-1 text-sm text-muted">
                {community.description || "Comunidade privada do Pizza Health."}
              </p>
              <div className="mt-3 flex items-center gap-3 text-xs text-muted">
                <span className="inline-flex items-center gap-1">
                  <Icon name="users" size={13} />
                  {community.memberCount} pessoa{community.memberCount === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Icon name="calendar" size={13} />
                  desde {formatDate(community.createdAt.slice(0, 10))}
                </span>
              </div>
              <div className="mt-4">
                <ButtonLink href={`/comunidade/${community.slug}`} size="sm">
                  Abrir comunidade
                </ButtonLink>
              </div>
            </Card>
          ))}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Criar uma comunidade</h2>
          <p className="mt-1 text-xs text-muted">
            Você será proprietário e poderá convidar pessoas e criar desafios.
          </p>
          <ActionForm action={createCommunityAction} className="mt-4 space-y-3">
            <Field label="Nome" htmlFor="community-name">
              <Input id="community-name" name="name" required minLength={3} maxLength={80} placeholder="ex.: Turma do bairro" />
            </Field>
            <Field label="Descrição (opcional)" htmlFor="community-description">
              <Textarea
                id="community-description"
                name="description"
                maxLength={280}
                rows={3}
                placeholder="Qual é o combinado do grupo? Ex.: check-up junto, caminhada no sábado."
              />
            </Field>
            <SubmitButton pendingLabel="Criando…">Criar comunidade</SubmitButton>
          </ActionForm>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Como funcionam os convites</h2>
          <ul className="mt-3 space-y-3 text-sm text-ink-soft">
            <li className="flex gap-2.5">
              <span className="text-tomato"><Icon name="link" size={16} /></span>
              Administradores geram um link válido por 7 dias. O token é guardado
              apenas como hash.
            </li>
            <li className="flex gap-2.5">
              <span className="text-tomato"><Icon name="lock" size={16} /></span>
              Quem entra não recebe acesso automático a exames, vacinas ou hábitos.
            </li>
            <li className="flex gap-2.5">
              <span className="text-tomato"><Icon name="shield" size={16} /></span>
              Convites podem ser revogados a qualquer momento. Membros também podem
              sair por conta própria.
            </li>
          </ul>
          <div className="mt-4 rounded-xl border border-line bg-surface-soft p-3 text-xs text-muted">
            Recebeu um link? Abra o endereço <span className="font-mono">/convite/…</span>{" "}
            no navegador ou peça para reenviarem. Também é possível{" "}
            <Link href="/perfil/privacidade" className="underline">
              revisar o compartilhamento
            </Link>{" "}
            a qualquer momento.
          </div>
        </Card>
      </div>
    </div>
  );
}
