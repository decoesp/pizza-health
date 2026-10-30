# Deploy e operação

## Infraestrutura

- Plataforma: pizzabase VMS, organização `decoesp`.
- MCP: `pizzabase-vms` (`https://vms.pizzaria.foundation/mcp`).
- Máquina: `pizza-health` (`m-W2-BJrN7dGOErzGPin97qg`), imagem
  `node:22.18-alpine3.21`, 2 GB de memória, disco de 2 GB, porta 3000, idle
  timeout de 300 s.
- Deploy ativo: `d-1793210624625`, status `ready`.
- URL: `https://pizza-health.app.pizzaria.foundation`.
- Banco em produção: **SQLite local** em `/work/.data/pizza-health.db`
  (`DB_MODE=local`).
- Banco remoto de reserva: PizzaSQL `pizzaria/pizza-health` em
  `db.database.pizza:5432` (`DB_MODE=remote`), intacto e com seed demo limpo.
- Runtime: Next.js standalone.
- Repositório: `https://github.com/decoesp/pizza-health` (público).

O token do MCP e a senha do banco são credenciais de operação. Não os coloque no
repositório, em logs ou em mensagens. Em produção, use o mecanismo de segredos do
ambiente.

> **Modo de produção atual: SQLite local**
>
> A organização atingiu o limite de **8 conexões simultâneas** do PizzaSQL. Mesmo
> com `pizza-rats`, `pizza-rank` e `pizza-music` parados, novas conexões Postgres
> continuam falhando com `53300 too many connections for organization`, o que
> indica conexões órfãs presas no proxy do provedor. A API HTTP de consulta
> (`POST /{org}/{db}/query`) funciona, mas não oferece transações, que o app usa.
>
> Para entregar o MVP funcional, a produção passou a usar SQLite local. O banco
> remoto não foi apagado: continua com o seed demo limpo para quando a cota for
> restabelecida. Ver “Voltar ao banco remoto”.

> **Lições desta instalação**
>
> 1. O build precisa de pelo menos 1 GB de memória. Com 256 MB, `next build` foi
>    encerrado por OOM (exit 137). A configuração atual usa `mem_size_mib=2048`.
> 2. O `build_cmd` é passado na linha de comando do kernel; quebras de linha
>    fazem o comando ser truncado ("No build command"). Use uma única linha.
> 3. Nesta versão da plataforma, o `set_env` respondeu `ok` mas não apareceu no
>    ambiente do `run_cmd`. O fallback de produção é codificar o arquivo de
>    ambiente em base64 dentro do `run_cmd`, decodificar para `/tmp/ph.env` e
>    carregar com `set -a; . ...; set +a`.
>    **Risco:** quem tem leitura da máquina ou dos logs consegue decodificar os
>    segredos. Migre para segredos nativos quando disponível e rotacione as
>    credenciais (ver “Rotação de credenciais”).
> 4. O rootfs em cache corrompeu de forma intermitente após muitos deploys
>    (`EXT4-fs error`, `Directory index failed checksum`, `bad block bitmap
>    checksum`, `Cannot find module '/work/.next/standalone/server.js'`). As
>    imagens `node:22-alpine3.21`, `node:22.21-alpine3.21` e o disco de 4096 MB
>    apresentaram corrupção. A combinação estável foi
>    `node:22.18-alpine3.21` com disco de 2048 MB e a máquina recriada para
>    limpar o histórico (63 deploys na máquina anterior).
> 5. Cada deploy executa `rm -rf /work` no build. **O SQLite é recriado do zero a
>    cada deploy.** Exporte os dados antes de redeployar (ver “Backup”).
> 6. `.data/seed.done` evita reseed em reinícios. O `run_cmd` roda
>    `db:migrate` sempre e `db:seed` apenas quando o marcador não existe.

## Pré-requisitos

1. Repositório Git acessível pelo build da VMS.
2. Organização `decoesp` e permissão para criar máquinas.
3. Chave AES-256-GCM de 32 bytes e sal de rate limit gerados.
4. Conta administrativa definida (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).
5. Para o modo remoto: banco `pizza-health` provisionado e cota de conexões
   disponível.

Gerar segredos:

```bash
openssl rand -base64 32   # DOCUMENT_ENCRYPTION_KEY
openssl rand -base64 24   # RATE_LIMIT_SALT
```

## Banco e migrações

### Modo local (produção atual)

```bash
DB_MODE=local \
LOCAL_DB_PATH=/work/.data/pizza-health.db \
npm run db:migrate
```

O runner cria o diretório `.data`, aplica as migrações de
`src/lib/db/schema.ts` em transação e registra cada versão em
`schema_migrations`.

### Modo remoto (reserva)

```bash
DB_MODE=remote \
PIZZA_API_KEY='***' \
PIZZA_DB='pizzaria/pizza-health' \
PIZZA_DB_HOST='db.database.pizza' \
npm run db:migrate
```

O runner:

1. cria `schema_migrations` se necessário;
2. lê as migrações de `src/lib/db/schema.ts`;
3. aplica cada versão em transação;
4. registra a versão com timestamp.

### Seed

O seed de produção cria apenas a conta admin e não cria dados demo:

```bash
SEED_DEMO=0 \
ADMIN_EMAIL='admin@seudominio.com' \
ADMIN_PASSWORD='***' \
DB_MODE=local LOCAL_DB_PATH=/work/.data/pizza-health.db \
npm run db:seed
```

A instância de demonstração atual usa `SEED_DEMO=1` com a conta
`ana@pizzahealth.app` / `pizza-health-demo-2026`. **Troque essa senha no primeiro
acesso.** O seed é idempotente: não recria usuários existentes e não sobrescreve
senhas.

## Build e execução

Build efetivo na VMS (uma única linha):

```bash
set -e; apk add --no-cache git; rm -rf /work; git clone --depth=1 --branch main https://github.com/decoesp/pizza-health.git /work; cd /work; NEXT_PUBLIC_SITE_URL=https://pizza-health.app.pizzaria.foundation npm ci; NEXT_PUBLIC_SITE_URL=https://pizza-health.app.pizzaria.foundation npm run build; if [ -d public ]; then cp -r public .next/standalone/; fi; mkdir -p .next/standalone/.next; cp -r .next/static .next/standalone/.next/
```

Comando de execução (o arquivo de ambiente é decodificado para `/tmp` antes de
carregar):

```bash
cd /work; printf %s '<ENV_BASE64>' | base64 -d > /tmp/ph.env; set -a; . /tmp/ph.env; set +a; npm run db:migrate; if [ ! -f .data/seed.done ]; then npm run db:seed && touch .data/seed.done; fi; node .next/standalone/server.js
```

Alternativamente, `deploy_dockerfile_app` usa o `Dockerfile` incluído. Nesse caso,
os segredos entram por `set_env` (se o runtime da plataforma os injetar) e as
migrações precisam rodar antes do start.

## Variáveis de produção

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | sim | URL pública, usada em convites e metadata |
| `DB_MODE` | sim | `local` na produção atual; `remote` para o PizzaSQL |
| `LOCAL_DB_PATH` | sim no modo local | `/work/.data/pizza-health.db` |
| `PIZZA_API_KEY` | sim no modo remoto | senha do PizzaSQL; nunca versionar |
| `PIZZA_DB` | sim no modo remoto | `pizzaria/pizza-health` |
| `PIZZA_DB_HOST` | sim no modo remoto | `db.database.pizza` |
| `PIZZA_DB_PORT` | sim no modo remoto | `5432` |
| `DATABASE_POOL_MAX` | sim no modo remoto | `2` (limite da organização) |
| `DOCUMENT_ENCRYPTION_KEY` | sim | 32 bytes em base64 |
| `RATE_LIMIT_SALT` | sim | mínimo 16 caracteres |
| `MAX_UPLOAD_BYTES` | não | padrão 8 MB |
| `SESSION_DAYS` | não | padrão 30 |
| `SEED_DEMO` | sim | `0` em produção; `1` só na demo |
| `ADMIN_EMAIL` | sim no primeiro boot | cria a conta administrativa |
| `ADMIN_PASSWORD` | sim no primeiro boot | use senha forte e rotacione |
| `ALLOW_RESET_LINK_IN_UI` | sim | `0` em produção |
| `OIDC_ISSUER` | não | padrão `https://auth.pizzaria.foundation` |
| `OIDC_CLIENT_ID` | não | padrão `pizza-healt` |
| `OIDC_CLIENT_SECRET` | para login federado | segredo do cliente; nunca versionar |
| `OIDC_REDIRECT_URI` | sim com OIDC | `https://health.pizzaria.foundation/auth/callback` |
| `OIDC_POST_LOGOUT_REDIRECT_URI` | sim com OIDC | `https://health.pizzaria.foundation` |
| `WEBAUTHN_RP_ID` | sim | `pizza-health.app.pizzaria.foundation` (domínio, sem porta) |
| `WEBAUTHN_RP_NAME` | não | `Pizza Health` |
| `MAX_APPLE_IMPORT_BYTES` | não | padrão 50 MB; produção em 120 MB; máximo 200 MB |

`NEXT_PUBLIC_SITE_URL` é público por definição. As demais variáveis são segredos.

> **Domínio do callback:** o cliente `pizza-healt` só aceita as URIs exatas
> `https://health.pizzaria.foundation/auth/callback`,
> `http://localhost:3000/auth/callback` e `http://localhost:8080/auth/callback`.
> Como `health.pizzaria.foundation` ainda não tem registro DNS, o login federado
> em produção só funciona depois de criar esse `A`/`CNAME` apontando para
> `191.252.200.77`. Não altere a URI para o host `app.` — não está registrada e o
> provedor recusa com `redirect_uri` inválido.

Arquivos locais usados na operação (fora do repositório, `chmod 600`):

- `~/.config/opencode/pizza-health-local.env` — produção atual (SQLite).
- `~/.config/opencode/pizza-health-prod.env` — reserva para o banco remoto.

## Passo a passo com o MCP

1. `list_orgs` → obter o id da organização `decoesp`.
2. `deploy_git_app` com:
   - `org_id`: id de `decoesp`
   - `name`: `pizza-health`
   - `repo`: URL do repositório
   - `branch`: `main`
   - `docker_image`: `node:22.18-alpine3.21`
   - `port`: `3000`
   - `build_cmd`: script acima
   - `run_cmd`: comando acima, sem segredos embutidos
3. `update_machine` com `mem_size_mib=2048` e `disk_size_mb=2048`.
4. `set_env` com as variáveis de produção (não confiável nesta versão; ver
   lição 3).
5. `deploy_machine` para aplicar as variáveis e reiniciar.
6. `get_machine_logs` para acompanhar o boot.
7. `get_machine` para confirmar `status=running|sleeping` e
   `last_deploy_status=ready`.
8. `get_machine_metrics` e `get_machine_requests` para observar tráfego.
9. `set_machine_access` para restringir IP/país se necessário.

O estado desejado é `running` ou `sleeping` com `last_deploy_status=ready`. A
primeira requisição pode demorar pelo cold start da VMS. O app sobe em até ~10 s;
se o healthcheck da plataforma falhar, um novo `deploy_machine` costuma resolver.

## Verificação pós-deploy

```bash
curl -fsS https://pizza-health.app.pizzaria.foundation/api/health
```

Resposta esperada no modo local:

```json
{ "status": "ok", "database": "local", "latencyMs": 5 }
```

No modo remoto, `"database": "remote"`. Se vier
`{"status":"unavailable","database":"remote"}`, a cota de conexões do PizzaSQL
está esgotada.

Depois:

```bash
PLAYWRIGHT_BASE_URL=https://pizza-health.app.pizzaria.foundation npx playwright test
```

Validação final em 28/10/2026 contra a produção: **39 aprovados, 19 ignorados,
0 falhas** (52,1 s), cobrindo desktop e mobile, axe, login, ranking, exportação,
upload/download/exclusão de documento, revogação de convite, entrada por link e
exclusão de conta. Persistência confirmada após stop/start da máquina.

Teste manual mínimo:

- criar conta;
- confirmar criação da comunidade pessoal;
- registrar água;
- criar post e comentar;
- gerar convite e abrir em outro navegador;
- enviar PDF e baixar;
- confirmar que outro membro não vê o documento sem compartilhamento;
- sair do ranking e confirmar que o nome some;
- cadastrar uma passkey em Perfil → Segurança e entrar com ela em outra janela;
- importar um `export.xml` real em Perfil → Importar e enviar arquivos, confirmar a
  prévia, aplicar e desfazer (XML acima de 4 MB vai compactado em gzip pelo
  navegador; se o arquivo passar de ~40 MB sem compactar, o proxy da plataforma
  aborta o envio);
- enviar um laudo em PDF na mesma página e abrir a revisão manual do documento;
- quando o DNS de `health.pizzaria.foundation` existir, testar o botão do Pizza
  Auth no host canônico e conferir o retorno em `/auth/callback`.

### Auth e importação em produção

- Passkeys: `WEBAUTHN_RP_ID` deve ser exatamente o host usado no navegador
  (`pizza-health.app.pizzaria.foundation`). Trocar de domínio invalida as
  passkeys já cadastradas.
- Pizza Auth: o fluxo usa `state`/`nonce`/PKCE guardados no banco, troca o código
  no callback e conclui com um ticket de uso único em `/auth/oidc/complete`.
  Nenhum token do provedor é persistido.
- Logout federado: só é disparado quando `OIDC_POST_LOGOUT_REDIRECT_URI` está
  definida **e** registrada no provedor. Sem ela, o app encerra apenas a sessão
  local para não terminar numa URL recusada. Enquanto o DNS de
  `health.pizzaria.foundation` não existir, mantenha a variável de fora em
  produção; depois do DNS, defina-a como `https://health.pizzaria.foundation` e
  redeploye para encerrar também a sessão do Pizza Auth.
- Apple Saúde: a rota `/api/import/apple-health/preview` está fora do matcher do
  proxy (o proxy clona o corpo e truncava em 10 MB); o limite real é
  `MAX_APPLE_IMPORT_BYTES` e o corpo é processado em memória. A prévia fica em
  `apple_health_imports` por até 24 h e o XML bruto nunca é gravado. O limite é
  `MAX_APPLE_IMPORT_BYTES` e a rota aceita até 4 importações por hora por usuário.
- Após um redeploy, a tabela `apple_health_imports` volta vazia junto com o banco
  SQLite local. Exporte antes se precisar manter histórico.

## Operação

### Rotina
- Monitorar `/api/health` e `get_machine_metrics`.
- Revisar `get_machine_logs` após cada deploy.
- Rodar `npm run db:status` antes de migrações.
- Fazer backup lógico antes de mudanças de schema.
- Evitar deploys desnecessários: cada deploy recria `/work` e zera o SQLite.

### Backup
No modo local, o banco é um único arquivo em `/work/.data/pizza-health.db`.
Como o deploy recria `/work`, o backup precisa ser externo:

1. Exportar os dados por usuário (Perfil → Privacidade → Exportar) antes de
   qualquer deploy que possa apagar a máquina.
2. Para backup operacional completo, copiar o arquivo SQLite para fora da VMS
   (por exemplo, via `run_cmd` com `base64` para um destino aprovado) e guardar
   com o mesmo cuidado de um banco de produção.
3. Um novo deploy **não** preserva `/work` por si só. O `build_cmd` atual copia
   `.data/pizza-health.db*` para `/root/ph-backup` antes do `rm -rf /work`, e o
   `run_cmd` restaura a cópia **apenas se o banco não existir** (primeiro boot
   após o build). Isso preserva os dados entre deploys e evita sobrescrever dados
   novos em restart. Para um backup externo, copie o arquivo para fora da VMS; a
   cópia em `/root` está no mesmo disco e não protege contra perda da máquina.

O PizzaSQL não expõe ferramenta de backup no MCP. O operador deve acordar com o
provedor uma rotina de backup/restore e testá-la. A exportação por usuário não
substitui backup operacional. Documente RPO/RTO.

### Voltar ao banco remoto

Quando a cota de conexões for restabelecida:

1. Confirmar que `npm run db:migrate` e `npm run db:seed` funcionam com
   `DB_MODE=remote` e `DATABASE_POOL_MAX=2`.
2. Trocar `DB_MODE` para `remote` no arquivo de ambiente de produção.
3. Redeployar com `~/.config/opencode/pizza-health-prod.env`.
4. Validar `/api/health` com `"database": "remote"`.
5. Migrar os dados criados no SQLite local, se houver, com exportação/importação
   assistida. Não sobrescrever o banco remoto sem backup.

Enquanto a cota não voltar, manter `DATABASE_POOL_MAX=2` no modo remoto e não
rodar vários apps da organização ao mesmo tempo.

### Rotação de credenciais
- Senha do banco (`PIZZA_API_KEY`): criar nova credencial, atualizar o ambiente,
  redeployar e revogar a anterior. **Pendente:** a chave atual apareceu em logs da
  VMS por causa do `run_cmd` em base64 e não pôde ser rotacionada com as
  ferramentas disponíveis; o titular da conta precisa rotacioná-la no provedor.
- Token do MCP: revogar e criar novo em `list_api_tokens`/`create_api_token`.
- Chave de documentos: exige decriptar e recriptografar todos os blobs. Não há
  rotina automática; planeje janela de manutenção e script específico. A chave e o
  sal foram rotacionados em 28/10/2026; documentos antigos não são decriptáveis
  com a chave nova, então o banco remoto foi resemeado.
- Senha admin: trocar em `/perfil/seguranca` após o primeiro login.

### Rollback
- Código: `deploy_machine` com branch/commit anterior ou `update_machine`.
- Schema: migrações são aditivas; para reverter dados, use backup.
- Configuração: `set_env` com os valores anteriores e redeploy.
- No modo local, rollback de código também recria o banco; exporte antes.

### Recuperação de máquina
- Se o rootfs corromper, recriar a máquina com `delete_machine` +
  `deploy_git_app` (mesmo nome e URL) usando `node:22.18-alpine3.21`,
  `mem_size_mib=2048`, `disk_size_mb=2048`.
- Não reutilizar imagens que apresentaram corrupção
  (`node:22-alpine3.21`, `node:22.21-alpine3.21`) nem disco de 4096 MB.
- Após recriar, o SQLite volta vazio; rode migração/seed e restaure o backup se
  houver.

### Incidente
Ver [`security.md`](security.md). Em caso de comprometimento, revogar sessões,
rotacionar segredos, preservar auditoria e avaliar comunicação a titulares/ANPD.

## Custos e limites

- Uma VM pequena atende o MVP.
- `idle_timeout` reduz custo; cold start aumenta a primeira latência.
- PizzaSQL limita **8 conexões por organização**; mantenha
  `DATABASE_POOL_MAX=2`. A cota é compartilhada por todos os apps da organização.
- Documentos no banco aumentam o tamanho do banco; o limite de 8 MB e a exportação
  de 20 MB são deliberados.
- O disco de 2 GB é suficiente para o app, mas o SQLite cresce com documentos;
  monitore o uso e exporte/arquive antes de encher.
