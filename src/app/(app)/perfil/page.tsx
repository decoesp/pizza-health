import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getProfile, countUserCommunities } from "@/lib/data/users";
import { countEntries } from "@/lib/data/habits";
import { countDocuments, countVaccines } from "@/lib/data/documents";
import { listAchievements, pointsTotal } from "@/lib/data/points";
import {
  Avatar,
  Card,
  Field,
  Input,
  PageHeader,
  Stat,
  Textarea,
} from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { Icon } from "@/components/ui/Icon";
import { updateProfileAction } from "@/actions/profile";
import { formatDate } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Perfil" };
export const dynamic = "force-dynamic";

const COLORS = [
  ["#C2410C", "tomate"],
  ["#3F6B4F", "manjericão"],
  ["#8A5A0F", "açafrão"],
  ["#4C6FA8", "azul"],
  ["#8A5A8F", "ameixa"],
  ["#B23E1F", "terracota"],
  ["#4F6B62", "sálvia"],
] as const;

export default async function ProfilePage() {
  const user = await requireUser("/perfil");
  const profile = await getProfile(user.id);
  if (!profile) notFound();
  const [communities, entries, documents, vaccines, points, achievements] = await Promise.all([
    countUserCommunities(user.id),
    countEntries(user.id),
    countDocuments(user.id),
    countVaccines(user.id),
    pointsTotal(user.id),
    listAchievements(user.id),
  ]);

  return (
    <div>
      <PageHeader
        eyebrow="Sua conta"
        title="Perfil e preferências"
        description="Seu nome, seu tom e o que cada comunidade pode ver. Você pode mudar de ideia quando quiser."
      />

      <div className="mb-5 flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-surface p-5">
        <Avatar name={profile.name} color={profile.avatarColor} size={64} />
        <div className="min-w-0 flex-1">
          <p className="text-lg font-semibold">{profile.name}</p>
          <p className="text-sm text-muted">{profile.email}</p>
          <p className="mt-0.5 text-xs text-muted">
            Na comunidade desde {formatDate(profile.createdAt.slice(0, 10))}
            {profile.city ? ` · ${profile.city}` : ""}
          </p>
        </div>
        <Link
          href="/perfil/privacidade"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-xs font-semibold hover:bg-surface-soft"
        >
          <Icon name="lock" size={14} />
          Privacidade
        </Link>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Comunidades" value={communities} icon="users" tone="tomato" />
        <Stat label="Registros" value={entries} icon="activity" tone="basil" />
        <Stat label="Documentos" value={documents} icon="file" tone="sky" />
        <Stat label="Vacinas" value={vaccines} icon="shield" tone="saffron" />
        <Stat label="Pontos" value={points} icon="trophy" tone="plum" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Card className="p-5">
          <h2 className="text-base font-semibold">Editar perfil</h2>
          <ActionForm action={updateProfileAction} className="mt-3 space-y-3">
            <Field label="Nome de exibição" htmlFor="profile-name">
              <Input id="profile-name" name="name" defaultValue={profile.name} required maxLength={80} />
            </Field>
            <Field label="Bio curta" htmlFor="profile-bio" hint="Até 280 caracteres. Aparece para quem pode ver seu perfil.">
              <Textarea id="profile-bio" name="bio" defaultValue={profile.bio ?? ""} maxLength={280} rows={3} />
            </Field>
            <Field label="Cidade" htmlFor="profile-city">
              <Input id="profile-city" name="city" defaultValue={profile.city ?? ""} maxLength={80} placeholder="opcional" />
            </Field>
            <fieldset>
              <legend className="mb-2 text-xs font-semibold text-ink-soft">Cor do avatar</legend>
              <div className="flex flex-wrap gap-2">
                {COLORS.map(([color, label]) => (
                  <label key={color} className="cursor-pointer" title={label}>
                    <input
                      type="radio"
                      name="color"
                      value={color}
                      defaultChecked={profile.avatarColor === color}
                      className="peer sr-only"
                    />
                    <span
                      className="flex h-9 w-9 items-center justify-center rounded-full ring-offset-2 peer-checked:ring-2 peer-checked:ring-ink"
                      style={{ backgroundColor: color }}
                    >
                      <span className="sr-only">{label}</span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <SubmitButton pendingLabel="Salvando…">Salvar perfil</SubmitButton>
          </ActionForm>
        </Card>

        <div className="space-y-4">
          {([
            ["/perfil/privacidade", "Privacidade e notificações", "lock", "Escolha o que cada comunidade vê."],
            ["/perfil/seguranca", "Segurança", "shield", "Senha, passkeys, sessões e encerramento remoto."],
            ["/perfil/importar", "Importar e enviar arquivos", "activity", "Apple Saúde, laudos e outros documentos."],
            ["/perfil/dados", "Seus dados", "file", "Exportar, corrigir ou excluir a conta."],
            ["/perfil/conquistas", "Conquistas", "trophy", `${achievements.length} desbloqueada${achievements.length === 1 ? "" : "s"}.`],
          ] as const).map(([href, title, icon, description]) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 hover:bg-surface-soft"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-tomato-soft text-tomato">
                <Icon name={icon as "lock"} size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold">{title}</span>
                <span className="block text-xs text-muted">{description}</span>
              </span>
              <Icon name="chevron-right" size={16} className="text-muted" />
            </Link>
          ))}

          <div className="rounded-2xl border border-line bg-surface-soft p-4 text-xs text-muted">
            <p className="font-semibold text-ink-soft">Privacidade por padrão</p>
            <p className="mt-1 leading-relaxed">
              Perfil é visível para membros da comunidade. Hábitos, vacinas e exames
              começam privados. O ranking é opcional.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
