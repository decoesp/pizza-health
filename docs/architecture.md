# Arquitetura

## Visão geral

```
Navegador
  └── Next.js App Router (RSC + Server Actions)
        ├── Route groups
        │     ├── (marketing)  páginas públicas e autenticação
        │     └── (app)        páginas autenticadas + shell
        ├── Actions             validação, autorização e escrita
        ├── Data access         consultas e DTOs
        └── DB adapter          SQLite local | PizzaSQL remoto
              └── Documentos    AES-256-GCM → base64 no banco
```

Não há API pública de domínio. As páginas são Server Components e leem dados por
funções server-only. As mutações são Server Actions com validação Zod e
`revalidatePath`. Os únicos route handlers são download de documento, exportação
LGPD e health check.

## Estrutura de pastas

```
src/
  app/
    (marketing)/       landing, login, cadastro, recuperação, convite, legais
    (app)/             dashboard, comunidade, hábitos, exames, vacinas, desafios,
                       ranking, perfil, notificações, admin
    api/               download, export, health
  actions/             auth, communities, posts, habits, documents, vaccines,
                       challenges, profile, notifications, admin
  components/          layout, UI, comunidade
  lib/
    auth/              senha, sessão, rate limit
    authz.ts           autorização centralizada
    crypto/documents   criptografia e validação binária
    data/              consultas por domínio
    db/                adapter, schema, migrações
    domain/            regras puras (datas, pontos, hábitos)
    audit.ts           auditoria minimizada
    notifications.ts   notificações internas
```

## Decisões

### 1. SQL portátil em vez de ORM

O PizzaSQL aceita um subconjunto próximo do SQLite. Para manter o mesmo código no
desenvolvimento e na produção, o adaptador:

- usa `?` na aplicação e reescreve para `$1..$n` no remoto;
- usa `TEXT` para IDs e timestamps ISO-8601;
- usa `INTEGER` para booleanos;
- evita `bytea`, `timestamptz`, `now()`, `ILIKE` e `ON DELETE CASCADE`;
- executa todas as transações com `BEGIN`/`COMMIT`/`ROLLBACK` explícitos.

Isso permite testar localmente com `node:sqlite` sem banco externo e trocar para o
PizzaSQL mudando apenas variáveis de ambiente.

### 2. Autorização na camada de dados

Toda operação sensível passa por uma função de autorização antes de tocar no
banco. Os pontos principais:

- `membershipFor(userId, communityId)` — vínculo e papel.
- `canViewDocument(viewerId, documentId)` — proprietário ou compartilhamento
  explícito em comunidade da qual o viewer participa.
- `canViewSharedCategory(viewerId, ownerId, communityId, category)` — permissão
  granular por categoria.
- `isManager(role)` — owner/admin.

Server Actions e route handlers chamam essas funções. Nenhuma página confia em
parâmetro de URL para autorização.

### 3. Sessão própria

Senha com scrypt (N=16384, r=8, p=1) e sal individual. Sessão com 32 bytes
aleatórios; o cookie guarda o token, o banco guarda apenas SHA-256. Expiração de 30
dias, renovação não automática, encerramento individual ou global.

### 4. Documentos cifrados no banco

Fluxo de upload:

1. `File` recebido por Server Action (limite de 12 MB no corpo; 8 MB de domínio).
2. Assinatura binária validada; HTML/SVG/executáveis recusados.
3. SHA-256 calculado para deduplicação.
4. AES-256-GCM com IV de 12 bytes e tag de 16 bytes.
5. Ciphertext base64 em `document_blobs`; metadados em `health_documents`.
6. Download exige sessão, autorização e decriptação no servidor.

O banco nunca vê a chave. A chave fica em `DOCUMENT_ENCRYPTION_KEY`, fora do banco e
fora do código.

### 5. Revisão humana de resultados

Não há extração automática no MVP. Resultados são digitados manualmente com valor
textual, unidade, referência, página e método. Todo resultado nasce `pending` e só
vira `confirmed` ou `rejected` por ação do titular. O exame é confirmado quando
não há pendências e existe ao menos um resultado confirmado.

Essa escolha evita inventar valores, misturar exames ou declarar normalidade com
base em regras genéricas. O laudo original permanece a fonte de verdade.

### 6. Pontuação idempotente

`point_transactions` tem índice único `(user_id, kind, ref_type, ref_id)`. O
registro de hábito usa `habitTypeId:entryDate`, não o ID do lançamento, então
editar ou excluir/recriar o mesmo dia não duplica pontos. Pontos sociais têm teto
diário de 10 e são calculados no fuso de São Paulo.

O ranking consulta pontos por janela e membros por comunidade; não há tabela de
placar que possa divergir. Não há pontuação por exames, peso ou diagnóstico.

### 7. Feed sem vazamento clínico

Publicações são criadas apenas por ação explícita. O compartilhamento de hábito
gera uma frase com valor e hábito, nunca resultado de exame. Documentos não geram
publicação. O feed de comunidade filtra por vínculo e visibilidade.

### 8. Exclusão explícita

O PizzaSQL não aplica cascade. A exclusão de conta executa, em uma transação:

1. transferência ou arquivamento de comunidades;
2. remoção de documentos, blobs, compartilhamentos e vínculos;
3. remoção de hábitos, metas, exames, vacinas, posts, comentários e reações;
4. remoção de pontos, conquistas, notificações e sessões;
5. anonimização do usuário (e-mail inválido, nome "Conta excluída", senha
   aleatória, `deleted_at`).

Eventos de auditoria permanecem com `actor_id = NULL` para segurança operacional.

### 9. Login federado sem acoplar a sessão ao provedor

O Pizza Auth é usado só para autenticar. O fluxo:

1. `/auth/oidc/start` lê o discovery, gera `state`, `nonce` e `code_verifier`,
   guarda apenas o hash do `state` em `oidc_states` (10 min) e redireciona para
   `/authorize` com PKCE S256 e escopos `openid profile email offline_access`.
2. `/auth/callback` consome o `state` uma única vez, troca o código com o
   `code_verifier` e valida o `id_token` com `jose` (RS256 via JWKS, `iss`, `aud`,
   `exp`, `nonce`).
3. A conta é localizada por `oauth_accounts (provider, sub)`; se o e-mail ainda
   não existir, o provisionamento reaproveita o mesmo caminho do cadastro
   (`provisionUser`). Nada do provedor é sobrescrito no perfil.
4. O callback emite um ticket de uso único (hash no banco, 5 min) e redireciona
   para `/auth/oidc/complete` no host principal, que cria a sessão própria.

O desvio pelo ticket existe porque o callback de produção fica em outro host
(`health.`); assim o cookie de sessão nunca precisa atravessar hosts. Tokens do
provedor não são persistidos e a sessão local não depende do TTL de 24 h do
refresh token.

### 10. Passkeys como segundo método, nunca único

WebAuthn usa `@simplewebauthn/server` com RP ID derivado de
`NEXT_PUBLIC_SITE_URL` (ou `WEBAUTHN_RP_ID`), `userVerification: required` e
challenge de uso único guardado como hash em `webauthn_challenges`, amarrado ao
navegador por cookie `httpOnly`. O contador é atualizado a cada login para
detectar clonagem. O e-mail é opcional: sem ele, o fluxo usa credencial
descobrível. Senha e Pizza Auth continuam disponíveis, então perder o dispositivo
não bloqueia a conta.

### 11. Importação do Apple Saúde com prévia e reversão

O `export.zip` é lido em streaming (`yauzl` + `sax`), sem gravar o XML. O
reconhecimento do formato inspeciona os primeiros 512 KB do arquivo, porque o
`export.xml` do app Saúde tem um DOCTYPE extenso antes de `<HealthData>`. O
navegador compacta XMLs acima de 4 MB em gzip antes do envio (o proxy da
plataforma recusa corpos grandes); o servidor descompacta em streaming e aplica
o limite de bytes ao conteúdo descompactado. Só quatro
métricas entram, limitadas aos últimos 365 dias: água, sono, movimento
(exercício declarado ou treino, o maior dos dois) e passos. O resultado agregado
por dia fica em `apple_health_imports` por até 24 h como prévia; ao confirmar,
cada dia vira `habit_entries` com `source='import'` e `import_id`, sem pontos.
Dias com registro manual são preservados. Desfazer remove apenas as linhas
daquele `import_id`.

## Fluxos principais

### Cadastro

`registerAction` valida, aplica rate limit, cria usuário + aceites legais +
comunidade pessoal + membership + preferências + hábitos padrão, cria sessão e
redireciona.

### Convite

Administrador gera token aleatório; banco guarda SHA-256 com validade de 7 dias.
A rota `/convite/[token]` procura pelo hash. A entrada valida expiração, cria
membership e preferências padrão e notifica o criador.

### Registro de hábito

`saveHabitEntryAction` valida hábito do usuário, data (não futura, até 12 meses),
valor e nota. Cria ou atualiza o registro; concede pontos apenas na criação;
avalia metas; avalia conquistas; audita; revalida dashboard, hábitos e ranking.

### Upload de exame

`uploadDocumentAction` valida arquivo e metadados, detecta duplicata, cifra, grava
documento + blob + compartilhamento opcional + exame estruturado quando categoria
é `exam`. Redireciona para o detalhe.

### Desafio

Progresso é derivado de `habit_entries` ou `point_transactions` no período. Ao
entrar no desafio, ou ao abrir a página, `evaluateChallengeAwards` verifica a meta
e concede pontos uma única vez por participante.

## Observabilidade

- `/api/health` verifica o banco e retorna modo e latência.
- Logs de erro não incluem conteúdo clínico.
- `audit_events` registra ação, entidade, comunidade, hash de IP e metadados
  primitivos. Nunca registra nome de exame, valor, diagnóstico ou arquivo.
- Não há analytics de terceiros.

## Evolução prevista

- Extração assistida de PDF/XLSX com revisão obrigatória e preservação de página.
- Fila assíncrona para documentos grandes.
- Envio de e-mail transacional com templates sem dados clínicos.
- Limitador distribuído.
- Backup e rotação de chave documentados por ambiente.
- Testes de contrato para o dialeto do PizzaSQL.
