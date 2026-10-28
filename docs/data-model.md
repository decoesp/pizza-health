# Modelo de dados

IDs são `TEXT` gerados pela aplicação. Datas e timestamps são `TEXT` ISO-8601.
Booleanos são `INTEGER` 0/1. Medidas são `REAL`. O schema está em
`src/lib/db/schema.ts` e é aplicado por `src/lib/db/migrate.ts`.

## Entidades e relações

### Identidade e conta

| Tabela | Função | Relações principais |
| --- | --- | --- |
| `users` | conta, perfil, privacidade, notificações | referenciada por quase tudo |
| `sessions` | token hash, expiração, user agent, IP hash | `user_id` |
| `password_resets` | token hash de uso único, expiração | `user_id` |
| `legal_acceptances` | termos, privacidade, dados de saúde | `user_id` |
| `data_requests` | exportação e exclusão | `user_id` |
| `oauth_accounts` | vínculo `(provider, sub)` do Pizza Auth | `user_id` |
| `oidc_states` | hash do state, nonce, verifier, destino, expiração | efêmera (10 min) |
| `login_tickets` | hash do ticket de uso único, destino, expiração | `user_id`; 5 min |
| `webauthn_credentials` | credencial pública, contador, transports, rótulo | `user_id`; `credential_id` único |
| `webauthn_challenges` | desafio de cadastro/login | efêmera (5 min) |

`oauth_accounts` guarda apenas o identificador do provedor e o e-mail usado no
vínculo; nenhum token OIDC é persistido. `oidc_states`, `login_tickets` e
`webauthn_challenges` são apagados ao serem consumidos e também por expiração.
O e-mail do provedor só cria conta nova se ainda não existir `users.email`
correspondente; caso exista, o `sub` é vinculado à conta local.

`users.deleted_at` marca a conta anonimizada. O e-mail é trocado por
`deleted+{id}@invalid.local` e a senha por um valor aleatório.

### Comunidades

| Tabela | Função | Restrições |
| --- | --- | --- |
| `communities` | grupo privado, convite | `slug` único; token só como hash |
| `community_members` | vínculo e papel | único `(community_id, user_id)` |
| `sharing_preferences` | permissão por categoria | único `(user_id, community_id, category)` |

Categorias: `profile`, `habits`, `vaccines`, `exams`. O padrão é perfil
compartilhado e o restante privado.

### Feed

| Tabela | Função |
| --- | --- |
| `posts` | publicação de texto, hábito, desafio ou conquista |
| `comments` | comentário com soft delete |
| `reactions` | reação única por pessoa/tipo/publicação |
| `content_reports` | denúncia com estado e resolução |

`posts.visibility` é `community` ou `private`. Posts privados só aparecem para o
autor. Reações têm único `(post_id, user_id, kind)`.

### Hábitos

| Tabela | Função |
| --- | --- |
| `habit_types` | hábito por pessoa, unidade, meta e direção |
| `habit_entries` | valor por dia, fonte e nota |
| `personal_goals` | meta diária ou semanal |

`habit_entries` tem único `(user_id, habit_type_id, entry_date)`. O índice
`(user_id, entry_date)` atende o dashboard e o histórico. A coluna `import_id`
liga registros criados por importação ao lote em `apple_health_imports`
(`preview` → `applied` → `undone`/`failed`), permitindo reverter sem tocar em
registros manuais. O payload guarda apenas os dias agregados e é esvaziado após
a aplicação.

### Documentos e exames

| Tabela | Função |
| --- | --- |
| `health_documents` | metadados, status, hash, vínculo com exame |
| `document_blobs` | ciphertext base64, IV e tag |
| `document_shares` | compartilhamento por documento/comunidade |
| `laboratory_exams` | exame estruturado, laboratório e datas |
| `exam_results` | indicador, valor, unidade, referência, método e validação |
| `vaccine_records` | vacina, dose, data, local e comprovante |

Únicos: `(user_id, sha256)` em documentos; `(document_id, community_id)` em
compartilhamentos. Resultados guardam o valor textual original e um numérico
opcional para ordenação, nunca substituindo o original.

### Desafios e gamificação

| Tabela | Função |
| --- | --- |
| `challenges` | desafio por comunidade, métrica e período |
| `challenge_participants` | participação única por desafio |
| `achievements` | conquista única por código |
| `point_transactions` | lançamento idempotente de pontos |
| `notifications` | caixa interna sem dados clínicos |

`point_transactions` tem único `(user_id, kind, ref_type, ref_id)`. Não existe
tabela de ranking materializada: o placar é derivado.

### Auditoria

| Tabela | Função |
| --- | --- |
| `audit_events` | ação, entidade, comunidade, hash de IP e metadados primitivos |

`metadata` é JSON serializado apenas com strings, números e booleanos. A aplicação
não envia conteúdo clínico para essa coluna.

## Índices principais

- `sessions(user_id)`, `sessions(expires_at)`
- `community_members(user_id)`, `(community_id, joined_at)`
- `posts(community_id, created_at, id)`, `posts(user_id, created_at)`
- `comments(post_id, created_at)`
- `reactions(post_id)`
- `habit_entries(user_id, entry_date)`, `(habit_type_id, entry_date)`
- `health_documents(user_id, created_at)`
- `document_shares(community_id)`
- `laboratory_exams(user_id, collected_on)`
- `exam_results(exam_id, name)`, `(user_id, created_at)`
- `vaccine_records(user_id, applied_on)`
- `point_transactions(user_id, created_at)`, `(created_at)`
- `notifications(user_id, created_at)`, `(user_id, read_at)`
- `audit_events(created_at)`, `(actor_id, created_at)`

## Regras de integridade

- IDs de aplicação são únicos e determinísticos no seed.
- Uniques impedem duplicação de membership, registro diário, reação, conquista,
  ponto, compartilhamento e arquivo.
- Checks limitam enums (papel, status, categoria, visibilidade, métrica).
- A aplicação valida que referências pertencem ao usuário/communities corretos.
- Exclusões compostas são explícitas e transacionais porque o PizzaSQL não aplica
  `ON DELETE CASCADE`.
- Datas futuras são recusadas para hábitos, vacinas, coleta e resultado.
- Resultados de exame exigem revisão do titular.

## Retenção

- Conta ativa: dados mantidos enquanto necessários ao serviço.
- Exportação: gerada na hora; o registro da solicitação permanece.
- Exclusão: dados pessoais e clínicos removidos; auditoria minimizada.
- Documentos: removidos com o blob e os compartilhamentos.
- Sessões: expiram ou são removidas no logout.
- Backups operacionais devem seguir a política do operador da instância.
