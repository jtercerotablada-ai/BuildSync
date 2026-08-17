"use client";

/**
 * "Client access" — the staff side of the password-less client link.
 *
 * Mounted on the project Overview for whoever passes the same gate as the
 * create route (project owner or ADMIN member). Everything here is about one
 * fact: the URL is shown exactly once, because only its SHA-256 is stored.
 */

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Link2, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ShareLinkRow {
  id: string;
  label: string;
  email: string | null;
  createdAt: string;
  lastSeenAt: string | null;
  viewCount: number;
  expiresAt: string;
  revokedAt: string | null;
}

interface Props {
  projectId: string;
}

const EXPIRY_CHOICES = [
  { days: 30, label: "30 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "6 months" },
  { days: 365, label: "1 year" },
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type LinkState = "active" | "revoked" | "expired";

function stateOf(row: ShareLinkRow): LinkState {
  if (row.revokedAt) return "revoked";
  if (new Date(row.expiresAt).getTime() <= Date.now()) return "expired";
  return "active";
}

export function ClientAccessPanel({ projectId }: Props) {
  const [links, setLinks] = useState<ShareLinkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(90);

  // The freshly minted URL. Held in component state only — there is no way
  // to fetch it back once this unmounts.
  const [mintedUrl, setMintedUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`);
      if (!res.ok) throw new Error("Failed to load client links");
      const data = await res.json();
      setLinks(data.links ?? []);
    } catch {
      toast.error("Could not load client links");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!label.trim() || creating) return;
    setCreating(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share-links`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          label: label.trim(),
          email: email.trim() || undefined,
          expiresInDays,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to create link");

      setMintedUrl(data.url);
      setCopied(false);
      setLinks((prev) => [data.link, ...prev]);
      setLabel("");
      setEmail("");
      setFormOpen(false);
      toast.success("Client link created");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create link");
    } finally {
      setCreating(false);
    }
  }

  async function patch(linkId: string, action: "revoke" | "extend") {
    if (
      action === "revoke" &&
      !confirm(
        "Revoke this link? Anyone holding the URL loses access immediately, and it cannot be restored."
      )
    ) {
      return;
    }
    try {
      const res = await fetch(
        `/api/projects/${projectId}/share-links/${linkId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update link");
      setLinks((prev) => prev.map((l) => (l.id === linkId ? data.link : l)));
      toast.success(action === "revoke" ? "Link revoked" : "Link extended");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update link");
    }
  }

  async function copy() {
    if (!mintedUrl) return;
    try {
      await navigator.clipboard.writeText(mintedUrl);
      setCopied(true);
      toast.success("Link copied");
    } catch {
      toast.error("Copy failed — select the link and copy it manually");
    }
  }

  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xl font-medium text-slate-900">Client access</h2>
        {!formOpen && (
          <button
            type="button"
            onClick={() => setFormOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#a8893a] hover:text-[#8a7028]"
          >
            <Plus className="h-3.5 w-3.5" />
            New link
          </button>
        )}
      </div>

      <p className="mb-3 text-sm text-slate-500">
        A private, read-only page showing this project&apos;s stage, dates,
        what you need from the client, shared documents and your latest note.
        No password, no account.
      </p>

      {/* The one and only sight of the URL. */}
      {mintedUrl && (
        <div className="mb-4 rounded-lg border border-[#a8893a]/40 bg-[#a8893a]/[0.07] p-3.5">
          <div className="mb-2 flex items-start justify-between gap-3">
            <p className="text-xs font-semibold text-[#8a7028]">
              Copy this link now — it will not be shown again.
            </p>
            <button
              type="button"
              onClick={() => setMintedUrl(null)}
              className="shrink-0 text-slate-400 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={mintedUrl}
              onFocus={(e) => e.currentTarget.select()}
              className="h-9 min-w-0 flex-1 rounded-md border border-slate-200 bg-white px-2.5 font-mono text-xs text-slate-700 outline-none"
            />
            <button
              type="button"
              onClick={() => void copy()}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-md bg-[#a8893a] px-3 text-xs font-medium text-white hover:bg-[#8a7028]"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">
            Only the link&apos;s fingerprint is stored, so we cannot show it to
            you again. If it is lost, revoke it and create a new one.
          </p>
        </div>
      )}

      {formOpen && (
        <div className="mb-4 rounded-lg border border-slate-200 bg-white p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs text-slate-500">
                Label <span className="text-slate-400">(who is this for?)</span>
              </label>
              <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value.slice(0, 120))}
                onKeyDown={(e) => e.key === "Enter" && void create()}
                placeholder="e.g. Board president"
                className="mt-0.5 h-9 w-full rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-300"
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">
                Email <span className="text-slate-400">(optional)</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && void create()}
                placeholder="owner@example.com"
                className="mt-0.5 h-9 w-full rounded-md border border-slate-200 px-2.5 text-sm outline-none focus:border-slate-300"
              />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <label className="text-xs text-slate-500">Expires in</label>
              <select
                value={expiresInDays}
                onChange={(e) => setExpiresInDays(Number(e.target.value))}
                className="mt-0.5 block h-9 rounded-md border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-slate-300"
              >
                {EXPIRY_CHOICES.map((c) => (
                  <option key={c.days} value={c.days}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setFormOpen(false);
                  setLabel("");
                  setEmail("");
                }}
                className="h-9 rounded-md px-3 text-sm text-slate-500 hover:text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void create()}
                disabled={!label.trim() || creating}
                className="flex h-9 items-center gap-1.5 rounded-md bg-[#a8893a] px-3 text-sm font-medium text-white hover:bg-[#8a7028] disabled:opacity-50"
              >
                {creating && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Existing links */}
      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : links.length === 0 ? (
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="flex w-full flex-col items-center gap-2 rounded-lg border border-dashed border-slate-300 py-7 text-center hover:border-slate-400 hover:bg-slate-50"
        >
          <Link2 className="h-5 w-5 text-slate-400" />
          <span className="text-sm font-medium text-slate-600">
            No client link yet
          </span>
          <span className="max-w-[380px] text-xs text-slate-500">
            Create one to give the building owner a private page for this
            project.
          </span>
        </button>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          {links.map((row, i) => {
            const state = stateOf(row);
            return (
              <div
                key={row.id}
                className={cn(
                  "flex flex-wrap items-center gap-x-4 gap-y-1.5 px-3.5 py-3",
                  i > 0 && "border-t border-slate-100",
                  state !== "active" && "bg-slate-50/60"
                )}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "truncate text-sm font-medium",
                        state === "active" ? "text-slate-800" : "text-slate-400"
                      )}
                    >
                      {row.label}
                    </span>
                    {state === "revoked" && (
                      <span className="shrink-0 rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                        Revoked
                      </span>
                    )}
                    {state === "expired" && (
                      <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700">
                        Expired
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {row.email ? `${row.email} · ` : ""}
                    {row.viewCount === 0
                      ? "Not opened yet"
                      : `${row.viewCount} view${row.viewCount === 1 ? "" : "s"} · last ${formatDate(row.lastSeenAt)}`}
                    {" · "}
                    {state === "revoked"
                      ? `revoked ${formatDate(row.revokedAt)}`
                      : `expires ${formatDate(row.expiresAt)}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  {state === "expired" && (
                    <button
                      type="button"
                      onClick={() => void patch(row.id, "extend")}
                      className="text-xs font-medium text-[#a8893a] hover:text-[#8a7028]"
                    >
                      Extend 90 days
                    </button>
                  )}
                  {state !== "revoked" && (
                    <button
                      type="button"
                      onClick={() => void patch(row.id, "revoke")}
                      className="text-xs font-medium text-slate-500 hover:text-[#b4462f]"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
