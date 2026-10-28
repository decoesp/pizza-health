import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { ButtonLink } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Badge, Card } from "@/components/ui/Primitives";

export const metadata: Metadata = {
  title: "Pizza Health — cuidar junto fica mais leve",
};

const FEATURES = [
  {
    icon: "activity" as const,
    title: "Hábitos sem culpa",
    description:
      "Água, movimento, sono e hábitos personalizados. Metas que você define, com histórico e sequências de constância.",
  },
  {
    icon: "file" as const,
    title: "Exames organizados",
    description:
      "PDF, planilha ou foto em um só lugar, com data, laboratório e resultados revisados por você antes de valerem.",
  },
  {
    icon: "shield" as const,
    title: "Vacinas e prevenção",
    description:
      "Histórico cronológico, comprovantes e lembretes. Sem presumir que uma vacina existe só porque não há registro.",
  },
  {
    icon: "users" as const,
    title: "Comunidade privada",
    description:
      "Grupos por convite, feed de incentivo, comentários e reações. Nada de resultado clínico no feed automático.",
  },
  {
    icon: "flag" as const,
    title: "Desafios coletivos",
    description:
      "Metas individuais ou em time, com progresso transparente e sem recompensa por comportamento inseguro.",
  },
  {
    icon: "trophy" as const,
    title: "Ranking de participação",
    description:
      "Pontos por constância, apoio e desafios. Nunca por peso, exames, diagnóstico ou ausência de doença.",
  },
];

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect("/inicio");

  return (
    <>
      <section className="container-page grid gap-12 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:py-24">
        <div>
          <Badge tone="tomato">
            <Icon name="lock" size={12} />
            Rede privada de saúde
          </Badge>
          <h1 className="mt-5 max-w-2xl text-4xl font-semibold leading-[1.06] sm:text-5xl">
            Cuidar de você fica mais leve quando a turma cuida junto.
          </h1>
          <p className="mt-5 max-w-xl text-base leading-relaxed text-ink-soft">
            O Pizza Health reúne hábitos, exames, vacinas e desafios em uma
            comunidade privada de amigos. Você decide o que compartilhar — e o
            cuidado vem antes do placar.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <ButtonLink href="/criar-conta" size="lg">
              Criar minha conta
            </ButtonLink>
            <ButtonLink href="/entrar" variant="secondary" size="lg">
              Já tenho conta
            </ButtonLink>
          </div>
          <p className="mt-5 flex items-center gap-2 text-xs text-muted">
            <Icon name="shield" size={15} />
            Privacidade por padrão. Dados de saúde nunca viram conteúdo público.
          </p>
        </div>

        <div className="relative">
          <div className="absolute -top-6 -left-4 hidden h-20 w-20 rounded-full bg-saffron-soft sm:block" />
          <Card className="relative overflow-hidden p-5 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-tomato-soft text-tomato">
                  <Icon name="heart" size={18} />
                </span>
                <div>
                  <p className="text-sm font-semibold">Sua semana</p>
                  <p className="text-xs text-muted">Mesa de Domingo</p>
                </div>
              </div>
              <Badge tone="basil">constância</Badge>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {[
                ["Água", "1,8 L", "de 2 L", "drop", "bg-sky-soft text-sky"],
                ["Movimento", "35 min", "meta 30", "move", "bg-basil-soft text-basil"],
                ["Sono", "7,5 h", "meta 7", "moon", "bg-plum-soft text-plum"],
              ].map(([label, value, hint, icon, tone]) => (
                <div key={label} className="rounded-xl border border-line bg-surface-soft p-3">
                  <span className={`inline-flex rounded-full p-1.5 ${tone}`}>
                    <Icon name={icon as "drop"} size={14} />
                  </span>
                  <p className="mt-2 text-[0.65rem] font-semibold text-muted">{label}</p>
                  <p className="text-lg font-semibold">{value}</p>
                  <p className="text-[0.62rem] text-muted">{hint}</p>
                </div>
              ))}
            </div>

            <div className="mt-4 rounded-xl border border-line p-3.5">
              <div className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-basil text-xs font-bold text-white">
                  B
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold">Bruno Salles</p>
                  <p className="text-[0.65rem] text-muted">há 12 min</p>
                </div>
              </div>
              <p className="mt-2 text-sm text-ink-soft">
                Fechamos a meta de água da turma hoje? Eu já estou no segundo litro. 💧
              </p>
              <div className="mt-3 flex gap-2 text-[0.65rem] font-semibold text-muted">
                <span className="rounded-full bg-paper-deep px-2 py-1">💪 4</span>
                <span className="rounded-full bg-paper-deep px-2 py-1">🫶 2</span>
                <span className="rounded-full bg-paper-deep px-2 py-1">3 comentários</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between rounded-xl bg-paper-deep px-3.5 py-3">
              <div>
                <p className="text-[0.65rem] font-semibold text-muted">Desafio da semana</p>
                <p className="text-sm font-semibold">Cinco dias de hidratação</p>
              </div>
              <div className="text-right">
                <p className="text-lg font-semibold text-tomato">4/5</p>
                <p className="text-[0.6rem] text-muted">dias</p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <section className="border-y border-line bg-surface/60">
        <div className="container-page py-14">
          <div className="max-w-2xl">
            <p className="text-xs font-bold tracking-[0.16em] text-tomato uppercase">
              Um produto para a vida real
            </p>
            <h2 className="mt-2 text-3xl font-semibold">
              Informação de saúde com contexto, não com julgamento.
            </h2>
            <p className="mt-3 text-ink-soft">
              O Pizza Health não diagnostica, não prescreve e não classifica quem
              é saudável. Ele ajuda você a lembrar do que importa e a manter o
              cuidado por perto.
            </p>
          </div>
          <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title} className="p-5">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-tomato-soft text-tomato">
                  <Icon name={feature.icon} size={19} />
                </span>
                <h3 className="mt-3 text-base font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted">
                  {feature.description}
                </p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="container-page grid gap-8 py-14 lg:grid-cols-2 lg:items-center">
        <div>
          <p className="text-xs font-bold tracking-[0.16em] text-basil uppercase">
            Privacidade estrutural
          </p>
          <h2 className="mt-2 text-3xl font-semibold">
            O que é seu continua seu.
          </h2>
          <p className="mt-3 text-ink-soft">
            Entrar em uma comunidade não dá acesso automático aos seus documentos
            médicos. Cada categoria — perfil, hábitos, vacinas e exames — tem uma
            permissão própria, e cada documento pode ser compartilhado de forma
            individual.
          </p>
          <ul className="mt-6 space-y-3 text-sm text-ink-soft">
            {[
              "Arquivos são validados pelo conteúdo e armazenados criptografados.",
              "Links de download exigem sessão e autorização verificada no servidor.",
              "Resultados extraídos só valem depois da sua revisão e confirmação.",
              "Notificações externas nunca carregam valores de exames ou diagnósticos.",
            ].map((item) => (
              <li key={item} className="flex gap-2.5">
                <span className="mt-0.5 text-basil">
                  <Icon name="check" size={16} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>
        <Card className="p-6">
          <h3 className="text-lg font-semibold">Como começar</h3>
          <ol className="mt-4 space-y-4">
            {[
              ["Crie sua conta", "Sua primeira comunidade privada nasce junto com o perfil."],
              ["Convide sua turma", "Um link por convite, revogável e com validade."],
              ["Registre o básico", "Um hábito por dia já forma histórico. Sem pressão."],
              ["Compartilhe o que quiser", "Você escolhe o que entra no feed e no ranking."],
            ].map(([title, description], index) => (
              <li key={title} className="flex gap-3">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-tomato text-xs font-bold text-white">
                  {index + 1}
                </span>
                <div>
                  <p className="text-sm font-semibold">{title}</p>
                  <p className="text-xs text-muted">{description}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="mt-6">
            <ButtonLink href="/criar-conta" className="w-full">
              Começar agora
            </ButtonLink>
          </div>
        </Card>
      </section>

      <section className="border-t border-line bg-tomato-soft/50">
        <div className="container-page flex flex-col items-start justify-between gap-5 py-12 md:flex-row md:items-center">
          <div>
            <h2 className="text-2xl font-semibold">Cuidar junto é um hábito.</h2>
            <p className="mt-1.5 max-w-xl text-sm text-ink-soft">
              Crie sua comunidade, convide quem você confia e comece pelo registro
              mais simples do dia.
            </p>
          </div>
          <div className="flex gap-3">
            <ButtonLink href="/criar-conta" size="lg">
              Criar conta
            </ButtonLink>
            <Link
              href="/entrar"
              className="inline-flex items-center px-3 text-sm font-semibold text-tomato-deep hover:underline"
            >
              Entrar
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
