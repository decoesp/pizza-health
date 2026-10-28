import type { Metadata } from "next";
import { Card, Notice } from "@/components/ui/Primitives";

export const metadata: Metadata = { title: "Segurança" };

export default function SecurityPage() {
  return (
    <div className="container-page max-w-3xl py-12 lg:py-16">
      <p className="text-xs font-bold tracking-[0.18em] text-tomato uppercase">
        Segurança e confiança
      </p>
      <h1 className="mt-3 text-3xl font-semibold">Como protegemos os dados</h1>
      <p className="mt-3 text-sm text-ink-soft">
        Esta página descreve o que está implementado no MVP, sem certificações ou
        garantias que ainda não existam.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {[
          ["Senhas", "Hash scrypt com sal individual. A senha original nunca é armazenada."],
          ["Sessões", "Token aleatório, guardado apenas como hash; cookie httpOnly, SameSite=Lax e Secure em produção."],
          ["Documentos", "AES-256-GCM por arquivo. O banco guarda ciphertext, IV e tag; a chave fica fora do banco."],
          ["Autorização", "Toda leitura de documento e escrita sensível verifica a sessão e o vínculo no servidor."],
          ["Uploads", "Validação por assinatura binária, limite de tamanho, nome saneado e recusa de formatos ativos."],
          ["Auditoria", "Eventos de operações sensíveis sem valores clínicos, resultados ou conteúdo de arquivos."],
          ["Abuso", "Limite de tentativas de login, cadastro, convites e redefinição; pontos sociais com teto diário."],
          ["Headers", "CSP com nonce, HSTS em produção, nosniff, frame-ancestors none e política de permissões restritiva."],
        ].map(([title, body]) => (
          <Card key={title} className="p-5">
            <h2 className="text-base font-semibold">{title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{body}</p>
          </Card>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        <Notice tone="warning">
          Limitações conhecidas: o envio de e-mail não está configurado; a
          redefinição depende de um administrador gerar um link. O limitador de
          requisições é em memória e não é distribuído. A criptografia protege o
          conteúdo no banco, mas a chave precisa ser gerenciada com cuidado.
        </Notice>
        <Card className="p-5">
          <h2 className="text-base font-semibold">Resposta a incidentes</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-soft">
            Em caso de suspeita de acesso indevido, o operador deve revogar
            sessões, rotacionar a chave de documentos e o segredo de sessão,
            preservar logs de auditoria minimizados, avaliar a necessidade de
            comunicação aos titulares e à ANPD, e registrar o ocorrido. O contato
            de segurança deve ser definido pelo operador desta instância.
          </p>
        </Card>
      </div>
    </div>
  );
}
