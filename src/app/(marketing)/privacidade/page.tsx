import type { Metadata } from "next";
import { Card } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Política de privacidade" };

const SECTIONS = [
  {
    title: "1. Quem trata os dados",
    body: "O Pizza Health é operado pela comunidade que mantém esta instância. O contato do responsável pelo tratamento deve ser informado pela pessoa ou organização que administra o serviço. Esta política descreve o comportamento do software e as escolhas de produto implementadas.",
  },
  {
    title: "2. Dados tratados",
    body: "Dados de conta (nome, e-mail, senha protegida por hash), preferências de privacidade e notificações, registros de hábitos, metas, publicações, comentários e reações, documentos enviados (PDF, CSV, XLS, XLSX, JPG e PNG), metadados de exames, resultados revisados e registros de vacinação. Dados de saúde são dados pessoais sensíveis e recebem tratamento reforçado.",
  },
  {
    title: "3. Finalidades e bases legais",
    body: "Os dados são usados para autenticar a conta, entregar as funcionalidades solicitadas, manter a segurança do serviço, registrar auditoria e cumprir obrigações legais. O tratamento de dados de saúde depende de consentimento específico e destacado, coletado no cadastro e reforçado pelas permissões de compartilhamento. O consentimento pode ser revogado, observadas as hipóteses legais de conservação.",
  },
  {
    title: "4. Compartilhamento",
    body: "Uma comunidade não recebe acesso automático aos documentos médicos. O compartilhamento é granular por categoria (perfil, hábitos, vacinas e exames) e, no caso de documentos, individual por arquivo. Publicações no feed são criadas por ação explícita da pessoa. Resultados clínicos não são publicados automaticamente.",
  },
  {
    title: "5. Ranking e gamificação",
    body: "O ranking mede participação e constância registrada. Ele não usa exames, diagnósticos, peso, doenças ou ausência de condições clínicas. A participação no ranking é opcional e pode ser desligada a qualquer momento. Pontos não são convertidos em qualquer benefício clínico.",
  },
  {
    title: "6. Segurança",
    body: "Senhas usam scrypt com sal individual. Sessões são armazenadas por hash de token em cookie httpOnly. Documentos são validados pelo conteúdo e armazenados com AES-256-GCM. O acesso a arquivos é verificado no servidor em cada requisição. Operações sensíveis geram eventos de auditoria sem valores clínicos. Nenhum sistema é imune a falhas; incidentes devem ser comunicados ao responsável pelo serviço.",
  },
  {
    title: "7. Retenção e exclusão",
    body: "Os dados permanecem enquanto a conta existir ou conforme a finalidade. A pessoa pode solicitar exportação e exclusão. A exclusão remove dados pessoais e documentos; registros de auditoria podem ser mantidos de forma minimizada para segurança e obrigações legais. Alguns dados podem ser retidos pelo prazo legal aplicável.",
  },
  {
    title: "8. Direitos",
    body: "A pessoa pode confirmar a existência de tratamento, acessar, corrigir, exportar, revogar consentimentos, solicitar anonimização, bloqueio ou eliminação de dados desnecessários e se opor a tratamentos. Em caso de impossibilidade técnica, o pedido é registrado e respondido pelo responsável.",
  },
  {
    title: "9. Transferências e terceiros",
    body: "O MVP não envia dados clínicos para ferramentas de analytics, monitoramento ou terceiros. O banco de dados é fornecido pela infraestrutura escolhida pelo operador. A avaliação jurídica de contratos, transferências internacionais e bases legais específicas deve ser feita antes de um lançamento público.",
  },
  {
    title: "10. Contato e atualizações",
    body: "Solicitações de privacidade podem ser feitas em Perfil → Dados e privacidade. Esta política pode ser atualizada; mudanças materiais devem ser comunicadas no produto. A versão vigente é identificada pelo aceite registrado na conta.",
  },
];

export default function PrivacyPage() {
  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Transparência
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Política de privacidade</h1>
      <p className="mt-3 text-sm text-muted">
        Versão 2026-10. Este documento descreve as escolhas do MVP e não substitui
        assessoria jurídica para lançamento público.
      </p>
      <div className="mt-8 space-y-4">
        {SECTIONS.map((section) => (
          <Card key={section.title} className="p-5">
            <h2 className="text-base font-semibold">{section.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{section.body}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
