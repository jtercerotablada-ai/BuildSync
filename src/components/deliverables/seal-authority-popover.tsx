"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { UserAvatar } from "./deliverable-bits";
import { apiJson, errorMessage } from "./deliverable-api";

interface SealMember {
  userId: string;
  name: string | null;
  image: string | null;
  role: string;
  sealAuthorizedAt: string | null;
  peLicenseNo: string | null;
  isOwner: boolean;
}

/**
 * OWNER-only: who may record PE seals. Seal authority lives on the
 * workspace seat (WorkspaceMember.sealAuthorizedAt), set only here — a job
 * title (User.position) grants nothing, because an admin can set their own.
 *
 * Each switch saves at once (and rolls back on failure); a license number
 * saves when its field loses focus. `onChanged` lets the tab refetch its
 * permissions, so a newly authorized owner-of-record sees "Mark sealed".
 *
 * It edits the PROJECT's workspace (passed as workspaceId), not the caller's
 * primary one — the API authorizes OWNER of that workspace.
 */
export function SealAuthorityPopover({
  workspaceId,
  onChanged,
}: {
  /** The PROJECT's workspace: the seats canSeal reads on this tab. */
  workspaceId: string | null;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<SealMember[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
      const data = await apiJson<{ members: SealMember[] }>(
        `/api/workspace/seal-authority${qs}`,
        {},
        "Couldn't load seal authority"
      );
      setMembers(data.members);
      setDrafts(
        Object.fromEntries(data.members.map((m) => [m.userId, m.peLicenseNo ?? ""]))
      );
    } catch {
      setLoadError(true);
    }
  }, [workspaceId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const save = async (
    m: SealMember,
    next: { authorized: boolean; peLicenseNo: string | null }
  ) => {
    if (savingId) return false;
    setSavingId(m.userId);
    const before = members;
    // Optimistic for the switch; rolled back below on failure.
    setMembers((list) =>
      list
        ? list.map((x) =>
            x.userId === m.userId
              ? {
                  ...x,
                  sealAuthorizedAt: next.authorized
                    ? x.sealAuthorizedAt ?? new Date().toISOString()
                    : null,
                  peLicenseNo: next.peLicenseNo,
                }
              : x
          )
        : list
    );
    try {
      const res = await apiJson<{ member: SealMember }>(
        "/api/workspace/seal-authority",
        {
          method: "PUT",
          json: {
            ...(workspaceId ? { workspaceId } : {}),
            userId: m.userId,
            authorized: next.authorized,
            peLicenseNo: next.peLicenseNo,
          },
        },
        "Couldn't update seal authority"
      );
      setMembers((list) =>
        list ? list.map((x) => (x.userId === m.userId ? res.member : x)) : list
      );
      setDrafts((d) => ({ ...d, [m.userId]: res.member.peLicenseNo ?? "" }));
      toast.success("Seal authority updated");
      onChanged();
      return true;
    } catch (err) {
      setMembers(before);
      setDrafts((d) => ({ ...d, [m.userId]: m.peLicenseNo ?? "" }));
      toast.error(errorMessage(err, "Couldn't update seal authority"));
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const commitLicense = (m: SealMember) => {
    const value = (drafts[m.userId] ?? "").trim();
    if (value === (m.peLicenseNo ?? "")) return;
    void save(m, {
      authorized: m.isOwner || m.sealAuthorizedAt != null,
      peLicenseNo: value || null,
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="text-slate-600">
          <ShieldCheck className="h-4 w-4" />
          <span className="hidden sm:inline">Seal authority</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,420px)] p-0">
        <div className="border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-900">Seal authority</p>
          <p className="mt-0.5 text-xs text-slate-500">
            Only licensed engineers you authorize here can mark revisions as sealed.
          </p>
        </div>
        <div className="max-h-[60vh] overflow-y-auto">
          {loadError ? (
            <div className="flex items-center justify-between gap-2 px-4 py-4 text-sm text-slate-500">
              Couldn&apos;t load the team.
              <Button size="sm" variant="outline" onClick={() => void load()}>
                Retry
              </Button>
            </div>
          ) : members === null ? (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
            </div>
          ) : members.length === 0 ? (
            <p className="px-4 py-4 text-sm text-slate-500">No contributors in this workspace.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {members.map((m) => {
                const authorized = m.isOwner || m.sealAuthorizedAt != null;
                const busy = savingId === m.userId;
                return (
                  <li key={m.userId} className="space-y-2 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar user={{ id: m.userId, name: m.name, image: m.image }} size={26} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-900">
                          {m.name || "Unnamed"}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {m.isOwner ? "Owner — always can seal" : m.role.charAt(0) + m.role.slice(1).toLowerCase()}
                        </p>
                      </div>
                      {busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400" />}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 pl-8">
                      {!m.isOwner && (
                        <label className="flex items-center gap-2 text-xs text-slate-700">
                          <Switch
                            checked={authorized}
                            disabled={!!savingId}
                            onCheckedChange={(v) =>
                              void save(m, {
                                authorized: v,
                                peLicenseNo: (drafts[m.userId] ?? "").trim() || null,
                              })
                            }
                            aria-label={`Can ${m.name ?? "this person"} record PE seals`}
                          />
                          Can record PE seals
                        </label>
                      )}
                      <div className="flex items-center gap-1.5">
                        <label htmlFor={`lic-${m.userId}`} className="text-xs text-slate-500">
                          License no.
                        </label>
                        <Input
                          id={`lic-${m.userId}`}
                          value={drafts[m.userId] ?? ""}
                          maxLength={40}
                          disabled={!!savingId}
                          placeholder="PE 12345"
                          onChange={(e) =>
                            setDrafts((d) => ({ ...d, [m.userId]: e.target.value }))
                          }
                          onBlur={() => commitLicense(m)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          }}
                          className="h-7 w-32 text-xs"
                        />
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
