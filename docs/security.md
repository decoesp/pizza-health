# Segurança e privacidade

## Ativos protegidos

- Credenciais de conta e sessões.
- Documentos médicos originais e seus metadados.
- Resultados de exames, referências e validações.
- Registros de hábitos, metas e vacinas.
- Vínculos de comunidade e preferências de compartilhamento.
- Eventos de auditoria e registros de solicitações LGPD.

## Modelo de ameaças (resumo)

| Ameaça | Controle implementado | Risco residual |
| --- | --- | --- |
| Acesso a documento de outra pessoa | Autorização no servidor em cada download; compartilhamento explícito | Falha de lógica futura; coberto por testes de isolamento |
| Vazamento por URL previsível | IDs aleatórios; rota exige sessão | Logs de proxy podem registrar caminho, não conteúdo |
| Upload malicioso | Validação por assinatura; recusa de HTML/SVG/executáveis; nome saneado; download com `attachment` | Parser de PDF/XLSX não é executado no MVP |
| Roubo de sessão | Cookie `httpOnly`, `SameSite=Lax`, `Secure` em produção; token só como hash | XSS em dependência de terceiros; CSP mitiga |
| Força bruta | Rate limit em login, cadastro, reset e convites | Limitador em memória, não distribuído |
| Duplicação de pontos | Índice único e teto social diário | Concorrência entre instâncias exigiria revisão |
| Manipulação de datas | Bloqueio de futuro e janela de 12 meses | Fuso do servidor e do usuário podem divergir em borda |
| Exposição em notificação | Conteúdo genérico, sem valores clínicos | Canais externos não implementados |
| Exclusão incompleta | Transação explícita, sem cascade | Backup/retensão legal podem manter cópias |
| Acesso administrativo indevido | Admin não vê documentos; auditoria; rota protegida | Admin comprometido ainda pode moderar conteúdo |
| Chave de documentos comprometida | Chave fora do banco; AES-GCM | Sem rotação automática implementada |

## Controles por camada

### Aplicação
- Server Actions sempre verificam sessão e vínculo.
- Zod valida entrada e limites de tamanho.
- Nenhuma consulta usa concatenação de entrada; apenas placeholders.
- IDs de documentos e comunidades são aleatórios.
- `revalidatePath` após mutações para evitar cache obsoleto.
- Erros não ecoam stack trace nem dados clínicos para o cliente.

### Sessão e senha
- scrypt com sal individual; comparação `timingSafeEqual`.
- Token de sessão de 32 bytes; hash SHA-256 no banco.
- Expiração configurável (30 dias por padrão).
- Troca de senha remove as outras sessões.
- Logout global disponível.
- Redefinição por token de 1 hora, uso único, guardado como hash.

### Documentos
- Limite de 8 MB por arquivo; Server Action limitada a 12 MB.
- Assinatura binária obrigatória para PDF, PNG, JPEG, XLS e XLSX; CSV validado como
  texto UTF-8 sem NUL.
- AES-256-GCM com IV aleatório de 12 bytes e tag de 16 bytes.
- Ciphertext em `document_blobs`; chave em variável de ambiente.
- Download com `Cache-Control: private, no-store`, `nosniff`, CSP sandbox e
  `Content-Disposition` controlado.
- Pré-visualização inline apenas para PDF/PNG/JPEG; demais formatos como anexo.

### Comunidades
- Convite por token de 7 dias, rotação e revogação.
- Papéis owner/admin/member.
- Remoção do proprietário bloqueada.
- Administrador não recebe acesso a documentos, exames ou vacinas.
- Denúncias podem ser resolvidas ou arquivadas com auditoria.

### Cabeçalhos HTTP
- CSP com nonce e `strict-dynamic` em produção; `unsafe-eval` apenas em dev.
- `base-uri 'self'`, `object-src 'none'`, `frame-ancestors 'none'`.
- HSTS em produção; `nosniff`; `Referrer-Policy`; `X-Frame-Options: DENY`.
- `Permissions-Policy` desliga câmera, microfone, geolocalização, pagamento e USB.
- Bloqueio de `/.env`, `/.git`, `wp-admin`, `phpmyadmin` etc.

## LGPD: mapa de tratamento

| Dado | Finalidade | Base | Compartilhamento |
| --- | --- | --- | --- |
| Nome, e-mail, senha | Conta e autenticação | Execução de contrato | Não compartilhado com comunidades |
| Bio, cidade, avatar | Perfil social | Consentimento/configuração | Conforme preferência |
| Hábitos e metas | Diário pessoal e ranking | Consentimento | Categoria + comunidade; ranking opt-in |
| Documentos e exames | Organização e histórico | Consentimento específico | Privado por padrão; documento individual |
| Vacinas | Histórico de prevenção | Consentimento específico | Categoria + comunidade; só confirmadas |
| Posts e comentários | Convivência | Consentimento | Comunidade escolhida |
| Pontos e conquistas | Gamificação | Consentimento | Ranking opt-in |
| Auditoria | Segurança e prevenção a fraude | Legítimo interesse/obrigação | Não exibida ao público |

O consentimento para usar o serviço é separado das autorizações de
compartilhamento. Revogar uma categoria remove o acesso imediatamente nas leituras
seguintes. A revogação não apaga o histórico do titular.

## Direitos do titular

- Acesso e confirmação: dashboard, perfil e exportação JSON.
- Correção: edição de perfil, hábitos, metadados, resultados e vacinas.
- Portabilidade: `/api/export` e `/api/export?files=1`.
- Revogação: preferências por comunidade e por documento.
- Eliminação: exclusão de conta com confirmação por senha e palavra-chave.
- Informação: políticas no produto e documentação técnica.

A exportação não inclui hash de senha, tokens de sessão, hashes de IP, chave de
criptografia ou segredos de infraestrutura.

## Administração e suporte

- `/admin` exige papel `admin`.
- Administradores podem gerar link de redefinição, mas não veem senhas.
- Administradores não abrem documentos de membros.
- Toda ação administrativa relevante gera `audit_events`.
- Solicitações de dados aparecem com estado; a conclusão é registrada.

## Resposta a incidentes

1. Conter: revogar sessões, desativar o serviço ou a máquina, se necessário.
2. Avaliar: identificar escopo, dados afetados, causa e horário.
3. Preservar: manter logs de auditoria e de infraestrutura minimizados.
4. Corrigir: aplicar patch, rotacionar segredos e chave de documentos.
5. Comunicar: avaliar dever de informar titulares e ANPD, conforme gravidade.
6. Registrar: abrir post-mortem sem dados clínicos e definir ações.

A rotação da chave de documentos exige rotina de decriptação e recriptografia, que
não está automatizada neste MVP. Planeje-a antes de um incidente real.

## Riscos residuais e pendências

- Sem MFA; recomendável para contas administrativas.
- Sem envio de e-mail; recuperação depende de admin.
- Rate limit em memória, por instância.
- Sem backup/restore verificado do PizzaSQL no produto; depende do provedor.
- Sem extração automática de documentos; menor superfície, menor automação.
- Sem varredura antivírus dos arquivos; formatos ativos são recusados, mas PDFs
  continuam sendo conteúdo não confiável.
- CSP depende do nonce aplicado pelo Next; validar a cada upgrade.
- A avaliação jurídica e o contrato de operador precisam ser formalizados.
