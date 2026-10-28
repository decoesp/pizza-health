import { Avatar, Badge } from "@/components/ui/Primitives";
import { ActionForm } from "@/components/ui/ActionForm";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { ConfirmButton } from "@/components/ui/ConfirmButton";
import { Icon } from "@/components/ui/Icon";
import { relativeTime } from "@/lib/domain/dates";
import { REACTIONS, type Comment, type Post } from "@/lib/data/feed";
import {
  addCommentAction,
  deletePostAction,
  reportPostAction,
  toggleReactionAction,
} from "@/actions/posts";

const REPORT_REASONS: Array<[string, string]> = [
  ["assedio", "Assédio ou constrangimento"],
  ["discurso_de_odio", "Discurso de ódio"],
  ["desinformacao", "Desinformação sobre saúde"],
  ["spam", "Spam ou conteúdo comercial"],
  ["outro", "Outro motivo"],
];

export function PostCard({
  post,
  comments,
  communitySlug,
  viewerId,
  canModerate = false,
  showComments = true,
}: {
  post: Post;
  comments: Comment[];
  communitySlug: string;
  viewerId: string;
  canModerate?: boolean;
  showComments?: boolean;
}) {
  const own = post.userId === viewerId;
  return (
    <article
      id={`post-${post.id}`}
      className="rounded-2xl border border-line bg-surface p-4 shadow-[0_1px_2px_rgba(36,31,27,0.04)] sm:p-5"
    >
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Avatar name={post.authorName} color={post.authorColor} size={36} />
          <div>
            <p className="text-sm font-semibold">{post.authorName}</p>
            <p className="text-xs text-muted">{relativeTime(post.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {post.kind === "habit" ? <Badge tone="sky">hábito</Badge> : null}
          {post.kind === "milestone" ? <Badge tone="saffron">conquista</Badge> : null}
          {post.visibility === "private" ? (
            <Badge tone="neutral">
              <Icon name="lock" size={11} />
              só você
            </Badge>
          ) : null}
        </div>
      </header>

      <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
        {post.body}
      </p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {REACTIONS.map((reaction) => {
          const active = post.viewerReactions.includes(reaction.kind);
          return (
            <ActionForm
              key={reaction.kind}
              action={toggleReactionAction}
              hideMessage
            >
              <input type="hidden" name="postId" value={post.id} />
              <input type="hidden" name="kind" value={reaction.kind} />
              <SubmitButton
                variant={active ? "soft" : "ghost"}
                size="sm"
                pendingLabel="…"
              >
                <span aria-hidden="true">{reaction.emoji}</span>
                {post.reactions[reaction.kind] > 0 ? post.reactions[reaction.kind] : reaction.label}
              </SubmitButton>
            </ActionForm>
          );
        })}
        <a
          href={`/comunidade/${communitySlug}#post-${post.id}`}
          className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-muted hover:text-tomato"
        >
          <Icon name="heart" size={14} />
          {post.commentCount} comentário{post.commentCount === 1 ? "" : "s"}
        </a>
      </div>

      {showComments ? (
        <div className="mt-4 border-t border-line pt-3">
          {comments.length > 0 ? (
            <ul className="space-y-2.5">
              {comments.map((comment) => (
                <li key={comment.id} className="flex gap-2.5">
                  <Avatar name={comment.authorName} color={comment.authorColor} size={26} />
                  <div className="min-w-0 rounded-xl bg-surface-soft px-3 py-2">
                    <p className="text-xs font-semibold">{comment.authorName}</p>
                    <p className="text-sm text-ink-soft">{comment.body}</p>
                    <p className="mt-0.5 text-[0.62rem] text-muted">
                      {relativeTime(comment.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted">Nenhum comentário ainda. Um incentivo curto já ajuda.</p>
          )}

          <ActionForm
            action={addCommentAction}
            className="mt-3 flex items-center gap-2"
            resetOnSuccess
          >
            <input type="hidden" name="postId" value={post.id} />
            <label htmlFor={`comment-${post.id}`} className="sr-only">
              Comentar na publicação de {post.authorName}
            </label>
            <input
              id={`comment-${post.id}`}
              name="body"
              required
              maxLength={600}
              placeholder="Deixe um incentivo…"
              className="min-w-0 flex-1 rounded-full border border-line-strong bg-surface px-3.5 py-2 text-sm focus:border-tomato focus:outline-none focus:ring-2 focus:ring-tomato/20"
            />
            <SubmitButton variant="soft" size="sm" pendingLabel="…">
              Enviar
            </SubmitButton>
          </ActionForm>

          <div className="mt-2 flex flex-wrap items-center gap-4">
            {own || canModerate ? (
              <ActionForm action={deletePostAction} hideMessage>
                <input type="hidden" name="postId" value={post.id} />
                <ConfirmButton
                  message="Apagar esta publicação? Os comentários deixarão de aparecer."
                  variant="ghost"
                  size="sm"
                >
                  Apagar
                </ConfirmButton>
              </ActionForm>
            ) : null}
            {!own ? (
              <details className="text-xs text-muted">
                <summary className="cursor-pointer hover:text-tomato">Denunciar</summary>
                <ActionForm action={reportPostAction} className="mt-2 space-y-2">
                  <input type="hidden" name="postId" value={post.id} />
                  <select
                    name="reason"
                    required
                    className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs"
                    aria-label="Motivo da denúncia"
                  >
                    {REPORT_REASONS.map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                  <textarea
                    name="details"
                    maxLength={500}
                    rows={2}
                    placeholder="Contexto opcional"
                    className="w-full rounded-lg border border-line-strong bg-surface px-2.5 py-1.5 text-xs"
                  />
                  <SubmitButton variant="secondary" size="sm" pendingLabel="Enviando…">
                    Enviar denúncia
                  </SubmitButton>
                </ActionForm>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
