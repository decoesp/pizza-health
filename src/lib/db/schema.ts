/**
 * Schema versionado, escrito no subconjunto comum a SQLite e PizzaSQL.
 *
 * Regras do dialeto:
 * - TEXT para IDs e timestamps ISO-8601 gerados pela aplicação;
 * - INTEGER para booleanos e contadores;
 * - REAL para medidas;
 * - sem `bytea`, `timestamptz`, `now()`, `ILIKE`, `ON DELETE CASCADE`;
 * - nenhuma consulta usa `?` nativo: a camada remota reescreve para `$n`.
 *
 * Foreign keys são declaradas para documentar o domínio. O PizzaSQL não aplica
 * cascade, então toda exclusão composta é feita explicitamente na aplicação.
 */

const initial = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
    avatar_color TEXT NOT NULL DEFAULT '#C2410C',
    bio TEXT,
    city TEXT,
    privacy_rank INTEGER NOT NULL DEFAULT 0,
    privacy_profile INTEGER NOT NULL DEFAULT 1,
    notify_comments INTEGER NOT NULL DEFAULT 1,
    notify_reactions INTEGER NOT NULL DEFAULT 1,
    notify_challenges INTEGER NOT NULL DEFAULT 1,
    notify_reminders INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_login_at TEXT,
    deleted_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS users_email_idx ON users (email)`,

  `CREATE TABLE IF NOT EXISTS legal_acceptances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('terms','privacy','health_data')),
    version TEXT NOT NULL,
    accepted_at TEXT NOT NULL
  )`,

  `CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    user_agent TEXT,
    ip_hash TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions (user_id)`,
  `CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)`,

  `CREATE TABLE IF NOT EXISTS password_resets (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL,
    requested_ip_hash TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS password_resets_user_idx ON password_resets (user_id)`,

  `CREATE TABLE IF NOT EXISTS communities (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_by TEXT NOT NULL REFERENCES users(id),
    invite_token_hash TEXT,
    invite_expires_at TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    archived_at TEXT
  )`,

  `CREATE TABLE IF NOT EXISTS community_members (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner','admin','member')),
    joined_at TEXT NOT NULL,
    UNIQUE (community_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS community_members_user_idx ON community_members (user_id)`,
  `CREATE INDEX IF NOT EXISTS community_members_community_idx ON community_members (community_id, joined_at)`,

  `CREATE TABLE IF NOT EXISTS sharing_preferences (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    community_id TEXT NOT NULL REFERENCES communities(id),
    category TEXT NOT NULL CHECK (category IN ('profile','habits','vaccines','exams')),
    shared INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, community_id, category)
  )`,

  `CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text','habit','challenge','milestone')),
    ref_id TEXT,
    visibility TEXT NOT NULL DEFAULT 'community' CHECK (visibility IN ('community','private')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS posts_feed_idx ON posts (community_id, created_at, id)`,
  `CREATE INDEX IF NOT EXISTS posts_user_idx ON posts (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS posts_deleted_idx ON posts (deleted_at)`,

  `CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    deleted_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS comments_post_idx ON comments (post_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS reactions (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL DEFAULT 'forca' CHECK (kind IN ('forca','apoio','fogo')),
    created_at TEXT NOT NULL,
    UNIQUE (post_id, user_id, kind)
  )`,
  `CREATE INDEX IF NOT EXISTS reactions_post_idx ON reactions (post_id)`,

  `CREATE TABLE IF NOT EXISTS content_reports (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL REFERENCES posts(id),
    reporter_id TEXT NOT NULL REFERENCES users(id),
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewing','resolved','dismissed')),
    created_at TEXT NOT NULL,
    resolved_at TEXT,
    resolved_by TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS content_reports_status_idx ON content_reports (status, created_at)`,

  `CREATE TABLE IF NOT EXISTS habit_types (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT 'spark',
    target_value REAL NOT NULL DEFAULT 0,
    direction TEXT NOT NULL DEFAULT 'at_least' CHECK (direction IN ('at_least','at_most')),
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, slug)
  )`,

  `CREATE TABLE IF NOT EXISTS habit_entries (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    habit_type_id TEXT NOT NULL REFERENCES habit_types(id),
    entry_date TEXT NOT NULL,
    amount REAL NOT NULL,
    note TEXT,
    source TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','import')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (user_id, habit_type_id, entry_date)
  )`,
  `CREATE INDEX IF NOT EXISTS habit_entries_user_date_idx ON habit_entries (user_id, entry_date)`,
  `CREATE INDEX IF NOT EXISTS habit_entries_type_idx ON habit_entries (habit_type_id, entry_date)`,

  `CREATE TABLE IF NOT EXISTS personal_goals (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    habit_type_id TEXT NOT NULL REFERENCES habit_types(id),
    title TEXT NOT NULL,
    target_value REAL NOT NULL,
    period TEXT NOT NULL DEFAULT 'daily' CHECK (period IN ('daily','weekly')),
    starts_on TEXT NOT NULL,
    ends_on TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','archived')),
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS personal_goals_user_idx ON personal_goals (user_id, status)`,

  `CREATE TABLE IF NOT EXISTS health_documents (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'exam' CHECK (category IN ('exam','vaccine','other')),
    file_name TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    size_bytes INTEGER NOT NULL,
    sha256 TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('received','processing','awaiting_review','confirmed','failed')),
    lab_name TEXT,
    collected_on TEXT,
    resulted_on TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    deleted_at TEXT,
    UNIQUE (user_id, sha256)
  )`,
  `CREATE INDEX IF NOT EXISTS health_documents_user_idx ON health_documents (user_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS document_blobs (
    document_id TEXT PRIMARY KEY REFERENCES health_documents(id),
    data TEXT NOT NULL,
    iv TEXT NOT NULL,
    tag TEXT NOT NULL,
    version INTEGER NOT NULL DEFAULT 1
  )`,

  `CREATE TABLE IF NOT EXISTS document_shares (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES health_documents(id),
    community_id TEXT NOT NULL REFERENCES communities(id),
    shared_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    UNIQUE (document_id, community_id)
  )`,
  `CREATE INDEX IF NOT EXISTS document_shares_community_idx ON document_shares (community_id)`,

  `CREATE TABLE IF NOT EXISTS laboratory_exams (
    id TEXT PRIMARY KEY,
    document_id TEXT REFERENCES health_documents(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    lab_name TEXT,
    collected_on TEXT,
    resulted_on TEXT,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','awaiting_review','confirmed')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS laboratory_exams_user_idx ON laboratory_exams (user_id, collected_on)`,

  `CREATE TABLE IF NOT EXISTS exam_results (
    id TEXT PRIMARY KEY,
    exam_id TEXT NOT NULL REFERENCES laboratory_exams(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    name TEXT NOT NULL,
    value_text TEXT NOT NULL,
    value_numeric REAL,
    unit TEXT,
    reference_range TEXT,
    flag TEXT,
    page_ref TEXT,
    extraction_method TEXT NOT NULL DEFAULT 'manual',
    validation_status TEXT NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','confirmed','rejected')),
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS exam_results_exam_idx ON exam_results (exam_id, name)`,
  `CREATE INDEX IF NOT EXISTS exam_results_user_idx ON exam_results (user_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS vaccine_records (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    document_id TEXT REFERENCES health_documents(id),
    name TEXT NOT NULL,
    manufacturer TEXT,
    dose_label TEXT,
    applied_on TEXT NOT NULL,
    location TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed')),
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS vaccine_records_user_idx ON vaccine_records (user_id, applied_on)`,

  `CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    community_id TEXT NOT NULL REFERENCES communities(id),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    kind TEXT NOT NULL DEFAULT 'individual' CHECK (kind IN ('individual','collective')),
    metric TEXT NOT NULL DEFAULT 'habit_days' CHECK (metric IN ('habit_days','habit_value','points')),
    habit_slug TEXT,
    target_value REAL NOT NULL,
    starts_on TEXT NOT NULL,
    ends_on TEXT NOT NULL,
    created_by TEXT NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','ended'))
  )`,
  `CREATE INDEX IF NOT EXISTS challenges_community_idx ON challenges (community_id, ends_on)`,

  `CREATE TABLE IF NOT EXISTS challenge_participants (
    id TEXT PRIMARY KEY,
    challenge_id TEXT NOT NULL REFERENCES challenges(id),
    user_id TEXT NOT NULL REFERENCES users(id),
    joined_at TEXT NOT NULL,
    UNIQUE (challenge_id, user_id)
  )`,
  `CREATE INDEX IF NOT EXISTS challenge_participants_user_idx ON challenge_participants (user_id)`,

  `CREATE TABLE IF NOT EXISTS achievements (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    code TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    earned_at TEXT NOT NULL,
    UNIQUE (user_id, code)
  )`,

  `CREATE TABLE IF NOT EXISTS point_transactions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL,
    ref_type TEXT NOT NULL,
    ref_id TEXT NOT NULL,
    points INTEGER NOT NULL,
    created_at TEXT NOT NULL,
    UNIQUE (user_id, kind, ref_type, ref_id)
  )`,
  `CREATE INDEX IF NOT EXISTS points_user_date_idx ON point_transactions (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS points_date_idx ON point_transactions (created_at)`,

  `CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    actor_id TEXT REFERENCES users(id),
    kind TEXT NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL DEFAULT '',
    href TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS notifications_user_idx ON notifications (user_id, created_at)`,
  `CREATE INDEX IF NOT EXISTS notifications_unread_idx ON notifications (user_id, read_at)`,

  `CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT NOT NULL,
    entity_id TEXT,
    community_id TEXT,
    ip_hash TEXT,
    metadata TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS audit_events_date_idx ON audit_events (created_at)`,
  `CREATE INDEX IF NOT EXISTS audit_events_actor_idx ON audit_events (actor_id, created_at)`,

  `CREATE TABLE IF NOT EXISTS data_requests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK (kind IN ('export','delete')),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','completed','rejected')),
    notes TEXT,
    created_at TEXT NOT NULL,
    processed_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS data_requests_user_idx ON data_requests (user_id, created_at)`,
];

const federatedAuth = [
  `CREATE TABLE IF NOT EXISTS oauth_accounts (
    id TEXT PRIMARY KEY,
    provider TEXT NOT NULL,
    subject TEXT NOT NULL,
    user_id TEXT NOT NULL REFERENCES users(id),
    email TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (provider, subject)
  )`,
  `CREATE INDEX IF NOT EXISTS oauth_accounts_user_idx ON oauth_accounts (user_id)`,

  `CREATE TABLE IF NOT EXISTS oidc_states (
    state_hash TEXT PRIMARY KEY,
    nonce TEXT NOT NULL,
    code_verifier TEXT NOT NULL,
    next_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS oidc_states_expiry_idx ON oidc_states (expires_at)`,

  `CREATE TABLE IF NOT EXISTS login_tickets (
    ticket_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    next_path TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    used_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS login_tickets_user_idx ON login_tickets (user_id)`,

  `CREATE TABLE IF NOT EXISTS webauthn_credentials (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    credential_id TEXT NOT NULL UNIQUE,
    public_key TEXT NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    transports TEXT,
    device_type TEXT,
    backed_up INTEGER NOT NULL DEFAULT 0,
    name TEXT,
    created_at TEXT NOT NULL,
    last_used_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS webauthn_credentials_user_idx ON webauthn_credentials (user_id)`,

  `CREATE TABLE IF NOT EXISTS webauthn_challenges (
    id_hash TEXT PRIMARY KEY,
    user_id TEXT,
    kind TEXT NOT NULL CHECK (kind IN ('register','authenticate')),
    challenge TEXT NOT NULL,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS webauthn_challenges_expiry_idx ON webauthn_challenges (expires_at)`,

  `CREATE TABLE IF NOT EXISTS apple_health_imports (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id),
    filename TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'preview' CHECK (status IN ('preview','applied','undone','failed')),
    payload TEXT NOT NULL,
    summary TEXT NOT NULL,
    created_at TEXT NOT NULL,
    applied_at TEXT,
    undone_at TEXT
  )`,
  `CREATE INDEX IF NOT EXISTS apple_health_imports_user_idx ON apple_health_imports (user_id, created_at)`,

  `ALTER TABLE habit_entries ADD COLUMN import_id TEXT`,
  `CREATE INDEX IF NOT EXISTS habit_entries_import_idx ON habit_entries (import_id)`,
];

export type Migration = {
  version: string;
  statements: string[];
};

export const MIGRATIONS: Migration[] = [
  {
    version: "001_initial",
    statements: initial,
  },
  {
    version: "002_federated_auth_and_imports",
    statements: federatedAuth,
  },
];
