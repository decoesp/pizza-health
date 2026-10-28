import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getCommunityBySlug } from "@/lib/data/communities";
import { isManager, membershipFor } from "@/lib/authz";
import { listReports } from "@/lib/data/feed";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import {
  moderateDeletePostAction,
  resolveReportAction,
} from "@/actions/posts";
import { formatDateTime } from "@/lib/domain/dates";

export const metadata: Metadata = { title: "Moderação" };
export const dynamic = "force-dynamic";

const REASON_LABEL: Record<string, string> = {
  assedio: "Assédio ou constrangimento",
  discurso_de_odio: "Discurso de ódio",
  desinformacao: "Desinformação sobre saúde",
  spam: "Spam ou conteúdo comercial",
  outro: "Outro motivo",
};

export default async function ModerationPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const user = await requireUser("/comunidade");
  const { slug } = await params;
  const community = await getCommunityBySlug(slug);
  if (!community) notFound();
  const membership = await membershipFor(user.id, community.id);
  if (!membership || !isManager(membership.role)) notFound();
  const reports = await listReports(community.id);
  const open = reports.filter((report) => report.status === "open" || report.status === "reviewing");

  return (
    <div>
      <PageHeader
        eyebrow={community.name}
        title="Moderação"
        description="Denúncias, contexto e decisões. A moderação cuida da convivência; não acessa dados clínicos."
        action={
          <Link href={`/comunidade/${community.slug}`} className="text-sm font-semibold text-tomato hover:underline">
            Voltar ao feed
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <Badge tone={open.length > 0 ? "tomato" : "basil"}>
          {open.length} aberta{open.length === 1 ? "" : "s"}
        </Badge>
        <Badge tone="neutral">{reports.length} no histórico</Badge>
      </div>

      {reports.length === 0 ? (
        <EmptyState
          title="Nenhuma denúncia"
          description="Quando alguém reportar uma publicação, ela aparece aqui para revisão."
          icon="shield"
        />
      ) : (
        <div className="space-y-4">
          {reports.map((report) => (
            <Card key={report.id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold">
                    {REASON_LABEL[report.reason] ?? report.reason}
                  </p>
                  <p className="text-xs text-muted">
                    denúncia de {report.reporterName} · {formatDateTime(report.createdAt)}
                  </p>
                </div>
                <Badge
                  tone={
                    report.status === "open"
                      ? "tomato"
                      : report.status === "resolved"
                        ? "basil"
                        : report.status === "dismissed"
                          ? "neutral"
                          : "saffron"
                  }
                >
                  {report.status}
                </Badge>
              </div>

              <blockquote className="mt-3 rounded-xl border-l-4 border-line-strong bg-surface-soft px-4 py-3 text-sm text-ink-soft">
                {report.postBody}
              </blockquote>
              {report.details ? (
                <p className="mt-2 text-xs text-muted">Contexto: {report.details}</p>
              ) : null}

              {report.status === "open" || report.status === "reviewing" ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionForm action={resolveReportAction} hideMessage>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="status" value="resolved" />
                    <SubmitButton size="sm" variant="basil" pendingLabel="…">
                      Resolver
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={resolveReportAction} hideMessage>
                    <input type="hidden" name="reportId" value={report.id} />
                    <input type="hidden" name="status" value="dismissed" />
                    <SubmitButton size="sm" variant="secondary" pendingLabel="…">
                      Arquivar
                    </SubmitButton>
                  </ActionForm>
                  <ActionForm action={moderateDeletePostAction} hideMessage>
                    <input type="hidden" name="postId" value={report.postId} />
                    <ConfirmButton
                      message="Remover a publicação denunciada? A denúncia será marcada como resolvida."
                      variant="danger"
                      size="sm"
                    >
                      Remover publicação
                    </ConfirmButton>
                  </ActionForm>
                </div>
              ) : null}
            </Card>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Decisões de moderação geram evento de auditoria sem copiar o conteúdo
        denunciado para os logs.
      </p>
    </div>
  );
}
