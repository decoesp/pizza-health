# Pizza Health

Rede social privada de saúde e bem-estar para comunidades de amigos. O produto
organiza hábitos, exames, vacinas e desafios sem transformar dados clínicos em
conteúdo público e sem classificar pessoas como "saudáveis" ou "doentes".

> **Estado:** MVP funcional, com autenticação própria e federada (Pizza Auth
> OIDC), passkeys, comunidades por convite, feed, hábitos, metas, importação do
> Apple Saúde, documentos criptografados, exames estruturados, vacinas, desafios,
> ranking de participação, notificações, exportação e exclusão de dados. A
> avaliação jurídica específica da instância ainda é necessária antes de um
> lançamento público.

## O que está implementado

### Conta e privacidade
- Cadastro, login, logout, recuperação por link de uso único e troca de senha.
- Login federado com **Pizza Auth** (OIDC authorization code + PKCE S256, nonce,
  validação de `iss`/`aud`/`exp` e assinatura RS256 via JWKS obtido por discovery).
  A conta local é vinculada pelo `sub`; o primeiro login provisiona usuário,
  comunidade pessoal, preferências e hábitos padrão.
- **Passkeys** (WebAuthn) como segundo fator de entrada: cadastro em Perfil →
  Segurança, login sem senha com Face ID/Touch ID/Windows Hello/chave de
  segurança, limite de 10 por conta e remoção a qualquer momento.
- Sessões com token aleatório guardado como hash, cookie `httpOnly`, `SameSite=Lax`
  e `Secure` em produção.
- Perfil com nome, bio, cidade e cor de avatar.
- Preferências de privacidade por categoria e por comunidade: perfil, hábitos,
  vacinas e exames.
- Ranking opcional, desligado por padrão no cadastro; ligado nos dados demo.
- Exportação JSON imediata, com opção de incluir arquivos.
- Exclusão de conta com confirmação por senha e palavra-chave, transferência de
  comunidades ou arquivamento, e anonimização do registro de usuário.

### Comunidades e feed
- Criação de comunidades privadas e criação automática da primeira comunidade no
  cadastro.
- Convites por link com token de 7 dias guardado apenas como hash, rotação e
  revogação.
- Papéis de proprietário, administrador e membro.
- Entrada por convite, saída, remoção e promoção de membros.
- Feed com publicações de texto, conquistas manuais, visibilidade privada,
  reações, comentários, exclusão pelo autor/moderação e denúncia.
- Moderação de denúncias com resolução ou remoção da publicação.
- Paginação do feed e das notificações.
- Perfil de membro com apenas as categorias que a pessoa autorizou. Documentos
  são compartilhados individualmente, nunca por padrão.

### Hábitos e metas
- Hábitos iniciais: água (ml), movimento (min) e sono (h).
- Criação de hábitos personalizados e metas diárias ou semanais.
- Registro por data, edição, remoção, resumo diário e histórico.
- Gráficos SVG de 7 e 14 dias, sequência de constância e tabela semanal.
- Registro manual com bloqueio de datas futuras e limite de 12 meses.
- Compartilhamento explícito de um registro no feed, nunca automático.

### Importação do Apple Saúde
- Envio de `export.zip` (ou `export.xml`) gerado pelo app Saúde do iPhone,
  com limite configurável (padrão 50 MB; produção em 120 MB). A rota de upload
  fica fora do matcher do proxy para o corpo grande não ser truncado.
- Leitura em streaming com `sax`, inclusive dentro do ZIP, sem gravar o XML bruto.
- Reconhecimento do arquivo olha os primeiros 512 KB, porque o `export.xml` real
  traz um DOCTYPE com vários kilobytes antes de `<HealthData>`.
- Apenas água, sono, movimento e passos dos últimos 12 meses; sono tem segmentos
  sobrepostos unificados e duração limitada a 24 h por dia.
- Prévia agregada por dia antes de confirmar; dias que já têm registro manual são
  preservados, não sobrescritos.
- Importação com `source=import` e `import_id`, permitindo **desfazer** e remover
  apenas o que veio do arquivo.
- Nenhum ponto de ranking é concedido por importação; o arquivo é processado em
  memória e descartado.
- A mesma página aceita **laudos e outros documentos** (PDF, CSV, XLS, XLSX, JPG
  ou PNG até 8 MB), que vão para a central criptografada com revisão manual —
  sem OCR e sem extração automática de resultados.

### Exames e documentos
- Upload de PDF, CSV, XLS, XLSX, JPG e PNG com validação pela assinatura binária.
- Limite de 8 MB por arquivo e corpo de Server Action de 12 MB.
- Criptografia AES-256-GCM por arquivo; o banco guarda ciphertext, IV e tag.
- Metadados de título, categoria, laboratório, datas e observações.
- Detecção de duplicata por SHA-256 por usuário.
- Download e pré-visualização com autorização conferida no servidor.
- Compartilhamento individual por comunidade e revogação.
- Status de processamento: recebido, processando, aguardando revisão, confirmado
  e falhou.
- Exames estruturados com resultados manuais, unidade, referência, página e
  método de extração.
- Cada resultado começa pendente e precisa de confirmação ou rejeição do titular.
- O exame só é confirmado quando não há pendências e há ao menos um resultado
  confirmado.
- Não há extração automática de PDF/planilha no MVP; o fluxo confiável é upload +
  digitação + revisão.

### Vacinas
- Registro de nome, fabricante, dose, data, local e comprovante opcional.
- Status pendente ou confirmado.
- Histórico cronológico, confirmação e remoção.
- Apenas registros confirmados aparecem no perfil compartilhado.
- Nenhuma presunção de vacinação por ausência de registro e nenhuma recomendação
  clínica automática.

### Desafios, pontos e ranking
- Desafios individuais ou coletivos nas comunidades.
- Métricas: dias com registro, soma do hábito ou pontos de participação.
- Progresso calculado a partir dos registros; não há armazenamento de placar
  paralelo que possa divergir.
- Pontos: +10 por hábito, +15 por meta, +30 por sequência de sete dias, +50/+40
  por desafio e +2/+1 por comentário/reação, com teto social de 10 por dia.
- Idempotência por índice único `(user_id, kind, ref_type, ref_id)`.
- Ranking semanal e mensal apenas de participação, com opt-in.
- Ranking nunca usa exames, diagnósticos, peso ou ausência de doença.
- Conquistas idempotentes e notificações internas.

### Painel e notificações
- Dashboard com resumo do dia, metas, gráfico de água, feed da comunidade,
  desafios, conquistas e atalhos.
- Notificações internas para comentários, reações, comunidade, desafios e
  conquistas. Sem valores clínicos no título ou corpo.

### Segurança e LGPD
- Autorização centralizada em `src/lib/authz.ts` e verificação em cada Server
  Action e route handler.
- CSP com nonce, HSTS em produção, `nosniff`, `frame-ancestors 'none'`, política
  de permissões restritiva e bloqueio de caminhos sensíveis.
- Auditoria de operações sensíveis sem conteúdo clínico.
- Política de privacidade, termos e página de segurança no produto.
- Exportação e exclusão implementadas, com limitações documentadas.

## Stack

- Next.js 16.4 (App Router, Server Components, Server Actions)
- React 19.3 e TypeScript estrito (`noUncheckedIndexedAccess`)
- Tailwind CSS 4
- `zod` para validação
- `jose` para OIDC/JWT (RS256 via JWKS) e `@simplewebauthn/*` para passkeys
- `sax` + `yauzl` para o parser streaming do export do Apple Saúde
- `node:sqlite` no desenvolvimento local; `pg` para o PizzaSQL remoto
- `node:test` + `tsx` para testes de unidade/integração
- Playwright + axe-core para E2E e acessibilidade
- `tsgo` (TypeScript nativo) para typecheck rápido; `tsc` continua disponível

Sem ORM, sem biblioteca de UI, sem serviço de analytics e sem CDN de terceiros.

## Como rodar localmente

Requisitos: Node.js 22+ (recomendado 24) e npm.

```bash
cd pizza-health
cp .env.example .env.local
# Gere a chave de documentos e o sal:
openssl rand -base64 32   # DOCUMENT_ENCRYPTION_KEY
openssl rand -base64 24   # RATE_LIMIT_SALT
npm install
npm run setup
npm run dev
```

Abra <http://localhost:3000>.

Login com Pizza Auth é opcional em desenvolvimento: sem `OIDC_CLIENT_SECRET` o
botão federado não aparece e tudo funciona por senha/passkey. Para habilitar,
preencha `OIDC_CLIENT_SECRET` (nunca versione) e mantenha
`OIDC_REDIRECT_URI=http://localhost:3000/auth/callback`, que já está registrado
no cliente `pizza-healt`. Use <http://localhost:3000>, não `127.0.0.1`: o RP ID
das passkeys é `localhost` (IP não é aceito pelo WebAuthn).

Conta demo criada pelo seed local:

- e-mail: `ana@pizzahealth.app`
- senha: `pizza-health-demo-2026`

O seed é idempotente e só cria dados demo quando `SEED_DEMO=1`. Em produção,
desligue `SEED_DEMO` e defina `ADMIN_EMAIL`/`ADMIN_PASSWORD` com uma senha real.

### Scripts

| Comando | Uso |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build de produção (standalone) |
| `npm run start` | Servidor de produção |
| `npm run setup` | Migrações + seed idempotente |
| `npm run db:migrate` | Aplica migrações pendentes |
| `npm run db:seed` | Cria admin e dados demo conforme env |
| `npm run db:status` | Contagens e versões de migração |
| `npm run db:reset` | Limpa dados (bloqueado em produção sem `ALLOW_DB_RESET=1`) |
| `npm test` | Testes de unidade e integração com `node:test` |
| `npm run test:e2e` | Playwright + axe |
| `npm run typecheck` | `tsgo --noEmit` |
| `npm run lint` | ESLint |
| `npm run verify` | lint + typecheck + testes |

## Variáveis de ambiente

| Variável | Padrão | Uso |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | `http://localhost:3000` | Metadata, links e convites |
| `DB_MODE` | `local` | `local` = SQLite; `remote` = PizzaSQL |
| `LOCAL_DB_PATH` | `.data/pizza-health.db` | Arquivo SQLite local |
| `PIZZA_API_KEY` | — | Senha do banco remoto |
| `PIZZA_DB` | `pizzaria/pizza-health` | Nome do banco remoto |
| `PIZZA_DB_HOST` | `db.database.pizza` | Host do banco |
| `PIZZA_DB_PORT` | `5432` | Porta |
| `DATABASE_POOL_MAX` | `2` | Conexões simultâneas (limite do PizzaSQL) |
| `DOCUMENT_ENCRYPTION_KEY` | — | Chave AES-256-GCM de 32 bytes em base64 |
| `MAX_UPLOAD_BYTES` | `8388608` | Limite por arquivo |
| `SESSION_DAYS` | `30` | Validade da sessão |
| `RATE_LIMIT_SALT` | — | Sal para hashes de IP e limitação |
| `SEED_DEMO` | `0` | Cria dados demo |
| `SEED_DEMO_PASSWORD` | — | Senha dos usuários demo |
| `ADMIN_EMAIL` | — | Conta administrativa criada pelo seed |
| `ADMIN_PASSWORD` | — | Senha da conta administrativa |
| `ALLOW_RESET_LINK_IN_UI` | `0` | Mostra o link de redefinição na resposta em dev |
| `OIDC_ISSUER` | `https://auth.pizzaria.foundation` | Emissor do Pizza Auth |
| `OIDC_CLIENT_ID` | `pizza-healt` | Cliente registrado no Pizza Auth |
| `OIDC_CLIENT_SECRET` | — | Segredo do cliente (obrigatório para habilitar o login federado) |
| `OIDC_REDIRECT_URI` | `{site}/auth/callback` | URI exata registrada no cliente |
| `OIDC_POST_LOGOUT_REDIRECT_URI` | `{site}` | Destino do logout no provedor |
| `WEBAUTHN_RP_ID` | host de `NEXT_PUBLIC_SITE_URL` | RP ID das passkeys (domínio, sem porta) |
| `WEBAUTHN_RP_NAME` | `Pizza Health` | Nome exibido no diálogo do dispositivo |
| `MAX_APPLE_IMPORT_BYTES` | `52428800` | Limite do `export.zip` (máx. 200 MB); produção em 120 MB |

Nunca versione `.env.local`. Em produção, configure os valores pelo mecanismo de
segredos da infraestrutura.

## Banco de dados

O PizzaSQL fala o protocolo do Postgres, mas aceita um subconjunto próximo do
SQLite. Por isso o projeto usa:

- `TEXT` para IDs e timestamps ISO-8601;
- `INTEGER` para booleanos e inteiros;
- `REAL` para medidas;
- `?` como placeholder na aplicação, reescrito para `$1..$n` no modo remoto;
- nenhum `bytea`, `timestamptz`, `now()`, `ILIKE` ou `ON DELETE CASCADE`.

As migrações ficam em `src/lib/db/schema.ts` e são aplicadas por
`src/lib/db/migrate.ts`, com registro em `schema_migrations`.

## Testes

```bash
npm test
npx playwright install chromium   # primeira vez
npm run test:e2e
```

Os testes de integração usam um SQLite temporário em `.data/test-pizza-health.db`
e cobrem isolamento entre usuários/comunidades, compartilhamento de categorias,
acesso a documentos, feed por comunidade e idempotência de pontos. `tests/oidc.test.ts`
exercita o fluxo completo do Pizza Auth com um provedor simulado (PKCE S256,
nonce, `iss`/`aud`, JWKS RS256, provisionamento, reuso de conta e ticket de uso
único). `tests/apple-health.test.ts` cobre agregação, sono sobreposto, `export.xml`
e `export.zip`.

Resultados reais da validação final (28/10/2026):

- `npm test`: **45 testes, 45 aprovados** (8 suítes).
- `npm run typecheck` (`tsgo`): **0 erros**.
- `npm run lint`: **0 erros e 0 avisos**.
- `npm run build`: **sucesso** (Next.js 16.4.3, standalone, 43 rotas).
- Playwright local: suíte completa em desktop e mobile, incluindo
  `tests/e2e/auth-import.spec.ts` (passkey com autenticador virtual, importação e
  reversão do Apple Saúde).
- Produção (`https://pizza-health.app.pizzaria.foundation`): **44 aprovados,
  20 ignorados, 0 falhas** (1,3 min), em desktop e mobile, incluindo passkey com
  autenticador virtual e importação/reversão do Apple Saúde. A suíte cobre axe em
  17 páginas, login, ranking, exportação, upload/download/exclusão de PDF,
  revogação de convite, entrada por link novo e exclusão de conta. A persistência
  foi confirmada após restart da máquina, com o banco restaurado do backup
  `/root/ph-backup` apenas quando `/work` é recriado.

## Produção

- **URL:** <https://pizza-health.app.pizzaria.foundation>
- **Infra:** máquina `pizza-health` (`m-W2-BJrN7dGOErzGPin97qg`) na organização
  `decoesp` do pizzabase VMS, imagem `node:22.18-alpine3.21`, 2 GB de memória,
  disco de 2 GB, idle timeout de 300 s. O deploy ativo é `d-1793300874365`,
  status `ready`, com `health.pizzaria.foundation` registrado como domínio
  customizado (dependente de DNS).
- **Banco em produção:** SQLite local em `/work/.data/pizza-health.db`
  (`DB_MODE=local`), com persistência real no disco da máquina.
- **Banco remoto de reserva:** PizzaSQL `pizzaria/pizza-health` (PostgreSQL 14,
  dialeto restrito), intacto e com seed demo limpo. A organização está com a cota
  de 8 conexões esgotada por conexões órfãs no proxy; por isso a produção usa
  SQLite local.
- **Repositório:** <https://github.com/decoesp/pizza-health> (público; nenhum
  segredo está no código).
- **Código em produção:** branch `main`, commit `229a420` (MVP + Pizza Auth +
  passkeys + importação do Apple Saúde + correção do limite de upload).
- **Health check:** `GET /api/health` responde `status: ok`, `database: local`.
- **Login federado:** o callback de produção registrado no Pizza Auth é
  `https://health.pizzaria.foundation/auth/callback`. Esse host ainda **não
  resolve em DNS** (NXDOMAIN); enquanto o registro `A` não apontar para
  `191.252.200.77`, o botão do Pizza Auth em produção não conclui o fluxo e o
  login por senha/passkey segue como caminho suportado. O RP ID das passkeys é o
  hostname de `NEXT_PUBLIC_SITE_URL` (`pizza-health.app.pizzaria.foundation`).
  O logout federado fica desligado em produção até o DNS existir
  (`OIDC_POST_LOGOUT_REDIRECT_URI` ausente), para não redirecionar para um host
  inacessível.

A instância de demonstração foi semeada com dados fictícios e a conta
`ana@pizzahealth.app` / `pizza-health-demo-2026`. **Troque essa senha no primeiro
acesso** em Perfil → Segurança. O seed usa `SEED_DEMO=1` apenas na demo; em uma
instância real, use `SEED_DEMO=0` com `ADMIN_EMAIL`/`ADMIN_PASSWORD`.

> **Atenção operacional (SQLite local):** cada deploy executa `rm -rf /work` e
> recria o banco do zero. O `build_cmd` copia `.data/pizza-health.db*` para
> `/root/ph-backup` antes da limpeza e o `run_cmd` restaura esse arquivo somente
> se o banco ainda não existir, para que stop/start não sobrescreva dados novos.
> Ainda assim, exporte os dados antes de um redeploy destrutivo ou faça backup do
> arquivo. O banco sobrevive a stop/start e sleep da máquina, mas um novo deploy
> depende dessa cópia de segurança. Quando a cota do PizzaSQL for restabelecida, o
> modo remoto pode ser reativado trocando `DB_MODE` para `remote`. Detalhes em
> [`docs/deploy.md`](docs/deploy.md).

> **Atenção de segurança:** nesta plataforma, o `set_env` do MCP não foi
> propagado ao comando de execução. O fallback usado foi um blob de ambiente
> codificado no `run_cmd` da máquina. Isso mantém os segredos fora do repositório,
> mas quem tem leitura na VMS consegue decodificá-los; a chave do banco apareceu
> nos logs da máquina. A chave de documentos e o sal foram rotacionados. **A
> `PIZZA_API_KEY` ainda precisa ser rotacionada no provedor pelo titular da
> conta.** Migre para o mecanismo de segredos da plataforma assim que estiver
> disponível.

## Deploy

O deploy de produção usa o MCP `pizzabase-vms` na organização `decoesp`, com
runtime Node 22.18 Alpine e SQLite local. O banco remoto `pizzaria/pizza-health`
fica como reserva até a cota de conexões ser restabelecida. O passo a passo, as
variáveis e os cuidados estão em [`docs/deploy.md`](docs/deploy.md).

## Limitações conhecidas

- Envio de e-mail não está configurado. A redefinição de senha depende de um
  administrador gerar um link de uso único.
- O limitador de requisições é em memória por instância; não é distribuído.
- Não há OCR nem extração automática de PDF/XLSX. Resultados são digitados e
  revisados manualmente.
- Documentos são guardados criptografados no banco. O limite de 8 MB por arquivo
  mantém o pacote de exportação dentro de 20 MB.
- O pacote de exportação inclui arquivos apenas quando `?files=1` e dentro do
  orçamento de 20 MB.
- Não há aplicativo móvel nativo; a interface é responsiva e testada em viewport
  móvel.
- A importação do Apple Saúde é manual (`export.zip`), não há sincronização
  contínua com o HealthKit. Só água, sono, movimento e passos são aproveitados.
- Passkeys exigem um dispositivo/navegador compatível; senha e Pizza Auth sempre
  continuam disponíveis como alternativa.
- Os tokens do Pizza Auth (access/id de 30 min, refresh de 24 h, sem rotação) não
  são usados para manter sessão: a sessão local é própria e independente. O
  refresh token é solicitado via `offline_access` apenas para compatibilidade
  com o provedor.
- O callback de produção do Pizza Auth depende do DNS de
  `health.pizzaria.foundation`, pendente fora do repositório.
- A avaliação jurídica e o contrato de tratamento de dados precisam ser feitos
  pelo operador antes de uso público.

## Documentação

- [`docs/architecture.md`](docs/architecture.md) — camadas, fluxos e decisões.
- [`docs/data-model.md`](docs/data-model.md) — entidades, índices e exclusão.
- [`docs/security.md`](docs/security.md) — ameaças, controles e riscos residuais.
- [`docs/deploy.md`](docs/deploy.md) — VMS, banco e operação.

## Aviso

Pizza Health não diagnostica, não prescreve e não substitui avaliação profissional.
Se você estiver passando por um problema de saúde, procure atendimento adequado.
