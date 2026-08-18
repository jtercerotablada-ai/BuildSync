"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SendHorizonal } from "lucide-react";

/**
 * The client's reply box. POSTs to the share link's one write endpoint and
 * then router.refresh()es — the page is force-dynamic, so the refresh
 * re-runs the projection and the new message arrives server-rendered, same
 * as everything else on the page. No optimistic state to get out of sync.
 */
export function PortalComposer({ token }: { token: string }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    const content = value.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/p/${token}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Could not send your message");
      }
      setValue("");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send your message");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-4 border-t border-[color:var(--line-soft)] pt-4">
      <div className="flex items-end gap-2.5">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
          rows={2}
          maxLength={2000}
          placeholder="Write a message to our team…"
          aria-label="Write a message to our team"
          className="min-h-[58px] flex-1 resize-y rounded-lg border border-[color:var(--line)] bg-[color:var(--surface)] px-3.5 py-2.5 text-[13px] leading-relaxed text-[color:var(--ink-900)] outline-none transition-colors placeholder:text-[color:var(--ink-400)] focus:border-[color:var(--gold-soft)] focus:ring-2 focus:ring-[color:var(--gold-pale)]"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={busy || value.trim().length === 0}
          className="p-btn p-btn--gold disabled:cursor-default disabled:opacity-45"
        >
          <SendHorizonal size={14} strokeWidth={1.9} aria-hidden />
          {busy ? "Sending…" : "Send"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[12px] font-medium text-[color:var(--red-ink)]">
          {error}
        </p>
      )}
      <p className="p-sub mt-2">
        Your message goes straight to the project team.
      </p>
    </div>
  );
}
