# Pizza Health

Rede social privada de saúde e bem-estar para comunidades de amigos. O produto
organiza hábitos, exames, vacinas e desafios sem transformar dados clínicos em
conteúdo público e sem classificar pessoas como "saudáveis" ou "doentes".

> **Estado:** MVP funcional, com autenticação, comunidades por convite, feed,
> hábitos, metas, documentos criptografados, exames estruturados, vacinas,
> desafios, ranking de participação, notificações, exportação e exclusão de dados.
> A avaliação jurídica específica da instância ainda é necessária antes de um
> lançamento público.

## O que está implementado

### Conta e privacidade
- Cadastro, login, logout, recuperação por link de uso único e troca de senha.
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
acesso a documentos, feed por comunidade e idempotência de pontos.

Resultados reais da validação final (28/10/2026):

- `npm test`: **32 testes, 32 aprovados** (7 suítes).
- `npm run typecheck` (`tsgo`): **0 erros**.
- `npm run lint`: **0 erros e 0 avisos**.
- `npm run build`: **sucesso** (Next.js 16.4.3, standalone, 39 rotas).
- Playwright local: **26 aprovados, 12 ignorados** por projeto/dispositivo; os
  ignorados são as execuções de axe no viewport móvel, que rodam só no desktop.
- Produção (`https://pizza-health.app.pizzaria.foundation`): **7 smoke aprovados
  (1 ignorado no desktop), 11 verificações de acessibilidade aprovadas e 1 teste
  de upload/download/exclusão aprovado**.

## Produção

- **URL:** <https://pizza-health.app.pizzaria.foundation>
- **Infra:** máquina `pizza-health` na organização `decoesp` do pizzabase VMS,
  runtime Node 24, 1 GB de memória, disco de 2 GB, idle timeout de 300 s.
- **Banco:** PizzaSQL `pizzaria/pizza-health` (PostgreSQL 14, dialeto restrito).
- **Repositório:** <https://github.com/decoesp/pizza-health> (público; nenhum
  segredo está no código).
- **Código em produção:** commit `f51621e` (MVP + `tsx` em runtime).
- **Health check:** `GET /api/health` responde `status: ok`, `database: remote`.

A instância de demonstração foi semeada com dados fictícios e a conta
`ana@pizzahealth.app` / `pizza-health-demo-2026`. **Troque essa senha no primeiro
acesso** em Perfil → Segurança. O seed de produção roda com `SEED_DEMO=0`, então
não recria dados demo em reinícios.

> **Atenção operacional:** nesta plataforma, o `set_env` do MCP não foi propagado
> ao comando de execução. O fallback usado foi um blob de ambiente codificado no
> `run_cmd` da máquina. Isso mantém os segredos fora do repositório, mas quem tem
> leitura na VMS consegue decodificá-los. Migre para o mecanismo de segredos da
> plataforma assim que ele estiver disponível e rotacione as credenciais. Detalhes
> em [`docs/deploy.md`](docs/deploy.md).

## Deploy

O deploy de produção usa o MCP `pizzabase-vms` na organização `decoesp`, com
runtime Node 24 e o banco `pizzaria/pizza-health`. O passo a passo, as variáveis e
os cuidados estão em [`docs/deploy.md`](docs/deploy.md).

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
