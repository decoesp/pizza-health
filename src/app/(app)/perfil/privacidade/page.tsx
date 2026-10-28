import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfile, listSharingPreferences, type SharingCategory } from "@/lib/data/users";
import { listCommunitiesForUser } from "@/lib/data/communities";
import { Card, Checkbox, Notice, PageHeader } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { setRankingVisibilityAction, updatePrivacyAction, updateCommunitySharingAction } from "@/actions/profile";

export const metadata: Metadata = { title: "Privacidade" };
export const dynamic = "force-dynamic";

const CATEGORY_LABEL: Record<SharingCategory, string> = {
  profile: "Perfil (nome, bio, cidade)",
  habits: "Hábitos e metas",
  vaccines: "Vacinas confirmadas",
  exams: "Documentos de exames",
};

export default async function PrivacyPage() {
  const user = await requireUser("/perfil/privacidade");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const communities = await listCommunitiesForUser(user.id);
  const preferences = new Map<string, Map<string, boolean>>();
  for (const community of communities) {
    const list = await listSharingPreferences(user.id, community.id);
    preferences.set(community.id, new Map(list.map((item) => [item.category, item.shared])));
  }

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow="Sua conta"
        title="Privacidade e notificações"
        description="Permissões granulares por categoria e por comunidade. O padrão é o mínimo necessário."
        action={
          <Link href="/perfil" className="text-sm font-semibold text-tomato hover:underline">
            Voltar ao perfil
          </Link>
        }
      />

      <div className="space-y-6">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Preferências gerais</h2>
          <ActionForm action={updatePrivacyAction} className="mt-3 space-y-3">
            <div className="grid gap-2 sm:grid-cols-2">
              <Checkbox
                name="ranking"
                label="Aparecer no ranking"
                description="Sua pontuação continua registrada mesmo se você sair do placar."
                defaultChecked={profile.privacyRank}
              />
              <Checkbox
                name="profile"
                label="Perfil visível por padrão"
                description="Nome, bio e cidade para membros das suas comunidades."
                defaultChecked={profile.privacyProfile}
              />
              <Checkbox
                name="notifyComments"
                label="Avisar sobre comentários"
                defaultChecked={profile.notifyComments}
              />
              <Checkbox
                name="notifyReactions"
                label="Avisar sobre reações"
                defaultChecked={profile.notifyReactions}
              />
              <Checkbox
                name="notifyChallenges"
                label="Avisar sobre desafios"
                defaultChecked={profile.notifyChallenges}
              />
              <Checkbox
                name="notifyReminders"
                label="Lembretes de hábitos"
                description="Lembretes internos. O envio externo não está configurado."
                defaultChecked={profile.notifyReminders}
              />
            </div>
            <SubmitButton size="sm" pendingLabel="Salvando…">
              Salvar preferências
            </SubmitButton>
          </ActionForm>
        </Card>

        <div>
          <h2 className="mb-1 text-base font-semibold">Compartilhamento por comunidade</h2>
          <p className="mb-3 text-sm text-muted">
            Entrar na comunidade não libera nada automaticamente. Desligar uma
            categoria revoga o acesso daquele grupo imediatamente.
          </p>
          {communities.length === 0 ? (
            <Notice tone="info">Você ainda não participa de comunidades.</Notice>
          ) : (
            <div className="space-y-4">
              {communities.map((community) => {
                const prefs = preferences.get(community.id);
                return (
                  <Card key={community.id} className="p-5">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{community.name}</h3>
                      <Link
                        href={`/comunidade/${community.slug}`}
                        className="text-xs font-semibold text-tomato hover:underline"
                      >
                        Abrir
                      </Link>
                    </div>
                    <ActionForm action={updateCommunitySharingAction} className="space-y-3">
                      <input type="hidden" name="communityId" value={community.id} />
                      <div className="grid gap-2 sm:grid-cols-2">
                        {(["profile", "habits", "vaccines", "exams"] as SharingCategory[]).map((category) => (
                          <Checkbox
                            key={category}
                            name={category}
                            label={CATEGORY_LABEL[category]}
                            defaultChecked={prefs?.get(category) ?? category === "profile"}
                          />
                        ))}
                      </div>
                      <SubmitButton size="sm" variant="secondary" pendingLabel="Salvando…">
                        Salvar nesta comunidade
                      </SubmitButton>
                    </ActionForm>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        <Card className="p-5">
          <h2 className="text-base font-semibold">Ranking</h2>
          <p className="mt-1 text-sm text-muted">
            Você está {profile.privacyRank ? "participando" : "fora"} do ranking.
          </p>
          <div className="mt-3">
            <ActionForm action={setRankingVisibilityAction} hideMessage>
              <input type="hidden" name="visible" value={profile.privacyRank ? "" : "1"} />
              <SubmitButton size="sm" variant={profile.privacyRank ? "secondary" : "primary"} pendingLabel="…">
                {profile.privacyRank ? "Sair do ranking" : "Entrar no ranking"}
              </SubmitButton>
            </ActionForm>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="text-base font-semibold">O que nunca fazemos</h2>
          <ul className="mt-2 space-y-1.5 text-xs text-muted">
            <li>Publicar resultados de exames automaticamente no feed.</li>
            <li>Dar a administradores acesso irrestrito a documentos médicos.</li>
            <li>Usar exames, diagnósticos ou peso para montar ranking.</li>
            <li>Enviar valores clínicos em notificações externas.</li>
          </ul>
        </Card>

        <div className="rounded-2xl border border-line bg-surface-soft p-4 text-xs text-muted">
          Precisa de um ajuste que não está aqui? Em{" "}
          <Link href="/perfil/dados" className="underline">
            Seus dados
          </Link>{" "}
          você pode exportar tudo, solicitar correção ou excluir a conta.
        </div>
      </div>
    </div>
  );
}
