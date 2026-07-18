"use client";

/**
 * Mention-aware task comments — the CLIENT renderer + composer input. The
 * pure string helpers (escape, build, plain-text) live in lib/comment-format
 * so the server can share them; the server is the trust boundary that
 * rebuilds stored content from validated mentions.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
  mentionHandle,
  unescapeHtml,
  type MentionMember,
} from "@/lib/comment-format";

// Re-export the pure helpers so existing importers keep working.
export {
  buildCommentContent,
  commentToPlainText,
  mentionHandle,
} from "@/lib/comment-format";

const MENTION_RE = /<span[^>]*data-user-id="([^"]+)"[^>]*>([^<]*)<\/span>/gi;

/** A mention candidate carries an avatar on top of the pure member shape. */
export interface MentionCandidate extends MentionMember {
  image: string | null;
}

/**
 * Render stored comment content to React nodes. Every dynamic string becomes
 * a React text child (auto-escaped) — there is NO dangerouslySetInnerHTML, so
 * nothing in a comment can execute. Mention spans render as chips using only
 * their inner display text; legacy raw comments un-escape to a near-no-op and
 * display exactly as before.
 */
export function renderCommentContent(content: string): ReactNode {
  MENTION_RE.lastIndex = 0;
  const out: ReactNode[] = [];
  let last = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  while ((m = MENTION_RE.exec(content)) !== null) {
    if (m.index > last) out.push(unescapeHtml(content.slice(last, m.index)));
    out.push(
      <span
        key={key++}
        className="text-[#a8893a] bg-[#c9a84c]/10 rounded px-0.5 font-medium"
      >
        {unescapeHtml(m[2])}
      </span>
    );
    last = m.index + m[0].length;
  }
  if (last < content.length) out.push(unescapeHtml(content.slice(last)));
  // No spans → a single un-escaped text node.
  if (out.length === 1 && typeof out[0] === "string") return out[0];
  return <>{out}</>;
}

// ─────────────────────────────────────────────────────────────────────────
// MentionInput — a single-line-style composer input with an @ typeahead.
// Modeled on the Messages view's MentionTextarea (same trigger detection
// and keyboard handling) but reusable and styled by the caller.
// ─────────────────────────────────────────────────────────────────────────

interface MentionInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Who can be mentioned. Empty array disables the typeahead. */
  candidates: MentionCandidate[];
  /** Called when a mention is confirmed so the caller can stage it. */
  onMentionAdd: (member: MentionCandidate) => void;
  /** Enter (without an open typeahead) submits. */
  onSubmit: () => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function MentionInput({
  value,
  onChange,
  candidates,
  onMentionAdd,
  onSubmit,
  placeholder,
  disabled,
  className,
}: MentionInputProps) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [trigger, setTrigger] = useState<{
    atIndex: number;
    query: string;
  } | null>(null);
  const [highlight, setHighlight] = useState(0);

  const matches = trigger
    ? candidates
        .filter((m) => {
          const q = trigger.query.toLowerCase();
          if (!q) return true;
          return (
            (m.name || "").toLowerCase().includes(q) ||
            (m.email || "").toLowerCase().includes(q)
          );
        })
        .slice(0, 8)
    : [];

  useEffect(() => {
    if (highlight >= matches.length) setHighlight(0);
  }, [matches.length, highlight]);

  // In an @ context when there's an "@" before the cursor with no
  // whitespace in between, and the "@" starts a word (so emails like
  // foo@bar don't trigger).
  const detectTrigger = (
    text: string,
    cursor: number
  ): { atIndex: number; query: string } | null => {
    for (let i = cursor - 1; i >= 0; i--) {
      const ch = text[i];
      if (ch === "@") {
        const prev = i === 0 ? "" : text[i - 1];
        if (prev === "" || /\s/.test(prev)) {
          return { atIndex: i, query: text.slice(i + 1, cursor) };
        }
        return null;
      }
      if (/\s/.test(ch)) return null;
    }
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const next = e.target.value;
    onChange(next);
    const cursor = e.target.selectionStart ?? next.length;
    const t = detectTrigger(next, cursor);
    setTrigger(t);
    if (t) setHighlight(0);
  };

  const confirmMention = (member: MentionCandidate) => {
    if (!trigger) return;
    const before = value.slice(0, trigger.atIndex);
    const after = value.slice(trigger.atIndex + 1 + trigger.query.length);
    const inserted = `${mentionHandle(member)} `;
    const next = before + inserted + after;
    onChange(next);
    onMentionAdd(member);
    setTrigger(null);
    requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      el.focus();
      const pos = before.length + inserted.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (trigger && matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        confirmMention(matches[highlight]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTrigger(null);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative flex-1 min-w-0">
      <textarea
        ref={ref}
        rows={1}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className={cn("resize-none", className)}
      />
      {trigger && matches.length > 0 && (
        <div className="absolute left-0 bottom-full mb-1 w-64 max-h-64 overflow-auto rounded-md border bg-white shadow-lg z-30">
          <div className="px-2 py-1 text-[10px] uppercase tracking-wider text-slate-400 border-b">
            Mention
          </div>
          {matches.map((m, idx) => {
            const display = m.name || m.email || "Unknown";
            return (
              <button
                key={m.id}
                type="button"
                onMouseEnter={() => setHighlight(idx)}
                onMouseDown={(e) => {
                  // mousedown (not click) so the textarea doesn't lose
                  // focus before we re-focus it.
                  e.preventDefault();
                  confirmMention(m);
                }}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-slate-50",
                  idx === highlight && "bg-[#c9a84c]/10"
                )}
              >
                <Avatar className="h-6 w-6">
                  <AvatarImage src={m.image || ""} />
                  <AvatarFallback className="text-[10px] bg-[#d4b65a] text-white">
                    {display.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {display}
                  </p>
                  {m.name && m.email && (
                    <p className="text-[11px] text-slate-500 truncate">
                      {m.email}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
