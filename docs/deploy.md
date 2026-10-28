# Deploy e operação

## Infraestrutura

- Plataforma: pizzabase VMS, organização `decoesp`.
- MCP: `pizzabase-vms` (`https://vms.pizzaria.foundation/mcp`).
- Máquina: `pizza-health` (Node 24 Alpine, 1 GB+, porta 3000).
- URL esperada: `https://pizza-health.app.pizzaria.foundation`.
- Banco: PizzaSQL `pizzaria/pizza-health` em `db.database.pizza:5432`.
- Runtime: Next.js standalone.

O token do MCP e a senha do banco são credenciais de operação. Não os coloque no
repositório, em logs ou em mensagens. Use o mecanismo de segredos do ambiente e o
`set_env` da máquina.

## Pré-requisitos

1. Repositório Git acessível pelo build da VMS.
2. Organização `decoesp` e permissão para criar máquinas.
3. Banco `pizza-health` provisionado.
4. Chave AES-256-GCM de 32 bytes e sal de rate limit gerados.
5. Conta administrativa definida (`ADMIN_EMAIL`, `ADMIN_PASSWORD`).

Gerar segredos:

```bash
openssl rand -base64 32   # DOCUMENT_ENCRYPTION_KEY
openssl rand -base64 24   # RATE_LIMIT_SALT
```

## Banco e migrações

Com o banco remoto configurado localmente:

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

O seed de produção cria apenas a conta admin e não cria dados demo:

```bash
SEED_DEMO=0 \
ADMIN_EMAIL='admin@seudominio.com' \
ADMIN_PASSWORD='***' \
DB_MODE=remote PIZZA_API_KEY='***' \
npm run db:seed
```

O seed é idempotente: não recria usuários existentes e não sobrescreve senhas.

## Build e execução

Build na VMS (esquema do MCP `deploy_git_app`):

```bash
set -e
apk add --no-cache git openssh-client
rm -rf /app-src
git clone --depth=1 --branch main <REPO_URL> /app-src
cd /app-src
npm ci
npm run build
cp -r public .next/standalone/
mkdir -p .next/standalone/.next
cp -r .next/static .next/standalone/.next/
```

Comando de execução:

```bash
cd /app-src
npm run db:migrate
npm run db:seed
DB_MODE=remote \
PIZZA_API_KEY='***' \
PIZZA_DB='pizzaria/pizza-health' \
PIZZA_DB_HOST='db.database.pizza' \
PORT=3000 HOSTNAME=0.0.0.0 \
node .next/standalone/server.js
```

Alternativamente, `deploy_dockerfile_app` usa o `Dockerfile` incluído. Nesse caso,
os segredos entram por `set_env` e as migrações precisam rodar antes do start.

## Variáveis de produção

| Variável | Obrigatória | Observação |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | sim | URL pública, usada em convites e metadata |
| `DB_MODE` | sim | `remote` |
| `PIZZA_API_KEY` | sim | senha do PizzaSQL; nunca versionar |
| `PIZZA_DB` | sim | `pizzaria/pizza-health` |
| `PIZZA_DB_HOST` | sim | `db.database.pizza` |
| `PIZZA_DB_PORT` | sim | `5432` |
| `DATABASE_POOL_MAX` | sim | `2` (limite da organização) |
| `DOCUMENT_ENCRYPTION_KEY` | sim | 32 bytes em base64 |
| `RATE_LIMIT_SALT` | sim | mínimo 16 caracteres |
| `MAX_UPLOAD_BYTES` | não | padrão 8 MB |
| `SESSION_DAYS` | não | padrão 30 |
| `SEED_DEMO` | sim | `0` em produção |
| `ADMIN_EMAIL` | sim no primeiro boot | cria a conta administrativa |
| `ADMIN_PASSWORD` | sim no primeiro boot | use senha forte e rotacione |
| `ALLOW_RESET_LINK_IN_UI` | sim | `0` em produção |

`NEXT_PUBLIC_SITE_URL` é público por definição. As demais variáveis são segredos.

## Passo a passo com o MCP

1. `list_orgs` → obter o id da organização `decoesp`.
2. `deploy_git_app` com:
   - `org_id`: id de `decoesp`
   - `name`: `pizza-health`
   - `repo`: URL do repositório
   - `branch`: `main`
   - `docker_image`: `node:24-alpine`
   - `port`: `3000`
   - `build_cmd`: script acima
   - `run_cmd`: comando acima, sem segredos embutidos
3. `set_env` com as variáveis de produção.
4. `deploy_machine` para aplicar as variáveis e reiniciar.
5. `get_machine_logs` para acompanhar o boot.
6. `get_machine` para confirmar `status=ready` e a URL.
7. `get_machine_metrics` e `get_machine_requests` para observar tráfego.
8. `set_machine_access` para restringir IP/país se necessário.

O estado desejado é `running` ou `sleeping` com `last_deploy_status=ready`. A
primeira requisição pode demorar pelo cold start da VMS.

## Verificação pós-deploy

```bash
curl -fsS https://pizza-health.app.pizzaria.foundation/api/health
```

Resposta esperada:

```json
{ "status": "ok", "database": "remote", "latencyMs": 123 }
```

Depois:

```bash
PLAYWRIGHT_BASE_URL=https://pizza-health.app.pizzaria.foundation npx playwright test
```

Teste manual mínimo:

- criar conta;
- confirmar criação da comunidade pessoal;
- registrar água;
- criar post e comentar;
- gerar convite e abrir em outro navegador;
- enviar PDF e baixar;
- confirmar que outro membro não vê o documento sem compartilhamento;
- sair do ranking e confirmar que o nome some.

## Operação

### Rotina
- Monitorar `/api/health` e `get_machine_metrics`.
- Revisar `get_machine_logs` após cada deploy.
- Rodar `npm run db:status` antes de migrações.
- Fazer backup lógico antes de mudanças de schema.

### Backup
O PizzaSQL não expõe ferramenta de backup no MCP. O operador deve acordar com o
provedor uma rotina de backup/restore e testá-la. A exportação por usuário não
substitui backup operacional. Documente RPO/RTO.

### Rotação de credenciais
- Senha do banco: criar nova credencial, atualizar `PIZZA_API_KEY`, redeployar e
  revogar a anterior.
- Token do MCP: revogar e criar novo em `list_api_tokens`/`create_api_token`.
- Chave de documentos: exige decriptar e recriptografar todos os blobs. Não há
  rotina automática; planeje janela de manutenção e script específico.
- Senha admin: trocar em `/perfil/seguranca` após o primeiro login.

### Rollback
- Código: `deploy_machine` com branch/commit anterior ou `update_machine`.
- Schema: migrações são aditivas; para reverter dados, use backup.
- Configuração: `set_env` com os valores anteriores e redeploy.

### Incidente
Ver [`security.md`](security.md). Em caso de comprometimento, revogar sessões,
rotacionar segredos, preservar auditoria e avaliar comunicação a titulares/ANPD.

## Custos e limites

- Uma VM pequena atende o MVP.
- `idle_timeout` reduz custo; cold start aumenta a primeira latência.
- PizzaSQL limita conexões por organização; mantenha `DATABASE_POOL_MAX=2`.
- Documentos no banco aumentam o tamanho do banco; o limite de 8 MB e a exportação
  de 20 MB são deliberados.
