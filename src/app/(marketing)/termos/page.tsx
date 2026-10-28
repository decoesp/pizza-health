import type { Metadata } from "next";
import { Card } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Termos de uso" };

const SECTIONS = [
  {
    title: "1. O que é o Pizza Health",
    body: "O Pizza Health é uma ferramenta de organização pessoal e convivência em comunidade. Ele não é serviço médico, não realiza diagnóstico, não prescreve tratamento e não substitui consulta, exame ou orientação de profissional habilitado.",
  },
  {
    title: "2. Uso responsável",
    body: "Você é responsável pelas informações que registra e pelo conteúdo que publica. Não use o serviço para incentivar restrição alimentar extrema, hidratação excessiva, exercício inseguro, automedicação ou qualquer comportamento que possa causar dano. Em caso de dúvida clínica, procure um profissional.",
  },
  {
    title: "3. Conta e segurança",
    body: "Mantenha sua senha em sigilo e não compartilhe sua sessão. Avise o administrador se suspeitar de acesso indevido. O serviço pode encerrar sessões e solicitar nova autenticação em situações de risco.",
  },
  {
    title: "4. Comunidades",
    body: "Comunidades são privadas e acessadas por convite. Administradores gerenciam membros e conteúdo, mas não recebem acesso automático a exames, vacinas ou hábitos dos participantes. O convite não transfere a propriedade de nenhum dado.",
  },
  {
    title: "5. Conteúdo e moderação",
    body: "Você mantém a titularidade do que publica. Ao publicar, autoriza a exibição na comunidade escolhida. Conteúdo abusivo pode ser denunciado e removido por administradores. Publicações podem ser apagadas pelo autor ou pela moderação da comunidade.",
  },
  {
    title: "6. Documentos e resultados",
    body: "Documentos enviados devem ser seus ou de alguém que autorizou o envio. Resultados digitados ou extraídos precisam ser revisados por você antes de serem considerados confirmados. O serviço não garante exatidão de leitura automática e não substitui o laudo original.",
  },
  {
    title: "7. Ranking e pontos",
    body: "Pontos e rankings são incentivos de participação. Não há prêmio clínico, diagnóstico ou garantia de saúde. Regras podem ser ajustadas para evitar abuso, duplicidade ou manipulação de datas.",
  },
  {
    title: "8. Disponibilidade e responsabilidade",
    body: "O serviço é fornecido no estado em que se encontra, sem garantia de disponibilidade ininterrupta. O operador não responde por decisões clínicas tomadas com base em informações registradas por usuários. Falhas de infraestrutura podem afetar temporariamente o acesso.",
  },
  {
    title: "9. Privacidade",
    body: "O tratamento de dados segue a política de privacidade. O uso do serviço implica ciência sobre as categorias de dados tratadas e sobre os controles de compartilhamento disponíveis.",
  },
  {
    title: "10. Encerramento",
    body: "Você pode solicitar a exclusão da conta em Perfil → Dados e privacidade. O operador pode suspender contas que violem estes termos, com registro de auditoria e possibilidade de contestação quando cabível.",
  },
];

export default function TermsPage() {
  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Regras do serviço
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Termos de uso</h1>
      <p className="mt-3 text-sm text-muted">
        Versão 2026-10. Leia junto com a política de privacidade.
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
