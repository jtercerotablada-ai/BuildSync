"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Mail,
  Link2,
  Copy,
  Check,
  Loader2,
  Search,
  UserPlus,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { teamInviteLinkCaption } from "@/lib/team-privacy";
import { toast } from "sonner";

interface WorkspacePerson {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle: string | null;
}

interface InviteTeamModalProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onInviteSent?: () => void;
  /**
   * Team privacy, so the invite-link caption can describe what the link
   * actually does. Optional because a caller that only has the team id
   * still gets the safe (narrowest) wording.
   */
  privacy?: string;
  /**
   * User ids already on the team. The workspace picker hides them — an
   * "Add" button that can only answer "User is already a team member" is
   * a control that exists to fail.
   */
  existingMemberIds?: string[];
}

export function InviteTeamModal({
  teamId,
  open,
  onClose,
  onInviteSent,
  privacy,
  existingMemberIds,
}: InviteTeamModalProps) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── Workspace picker ────────────────────────────────────────────
  // The firm is three people who are already in the workspace, so
  // "add a colleague" is the common case and emailing them an
  // invitation to something they can already see was the wrong shape.
  const [people, setPeople] = useState<WorkspacePerson[] | null>(null);
  const [peopleError, setPeopleError] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  // Ids added during this dialog session. The parent refetches the team,
  // but `existingMemberIds` only updates once that lands — without this the
  // row a user just added flickers back in with a live "Add" button.
  const [addedIds, setAddedIds] = useState<string[]>([]);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/teams/${teamId}/join`
      : "";

  const loadPeople = useCallback(() => {
    setPeopleError(false);
    setPeople(null);
    fetch("/api/workspace/members")
      .then((r) => {
        // A 401/500 parsed as JSON used to coerce to an empty list, which
        // renders "everyone is already on this team" over a failed load.
        if (!r.ok) throw new Error(String(r.status));
        return r.json();
      })
      .then((rows: unknown) => {
        if (!Array.isArray(rows)) throw new Error("Unexpected response");
        setPeople(
          rows
            .map((row) => (row as { user?: WorkspacePerson }).user)
            .filter((u): u is WorkspacePerson => !!u && !!u.id)
        );
      })
      .catch(() => {
        setPeople([]);
        setPeopleError(true);
      });
  }, []);

  // Load once per opening, not once per mount: the dialog stays mounted
  // between opens, so a colleague added elsewhere would never disappear.
  useEffect(() => {
    if (!open) return;
    setAddedIds([]);
    setPeopleSearch("");
    loadPeople();
  }, [open, loadPeople]);

  const onTeam = new Set([...(existingMemberIds ?? []), ...addedIds]);
  const term = peopleSearch.trim().toLowerCase();
  const candidates = (people ?? [])
    .filter((p) => !onTeam.has(p.id))
    .filter((p) =>
      term
        ? (p.name || "").toLowerCase().includes(term) ||
          (p.email || "").toLowerCase().includes(term)
        : true
    );

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Error copying link");
    }
  };

  /**
   * One path for both entry points: /invite takes an email address and,
   * for someone who already has an account, adds them to the team
   * outright. The picker just spares the user from typing an address
   * they shouldn't have to know.
   */
  const inviteByEmail = async (address: string) => {
    const res = await fetch(`/api/teams/${teamId}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: address }),
    });
    const data = await res.json().catch(() => null);

    // The route explains exactly what went wrong ("Only team leads or
    // workspace admins can invite members", "User is already a team
    // member"). That used to be thrown away for a generic message, so
    // the user had no idea whether to retry or ask an admin.
    if (!res.ok) {
      throw new Error(data?.error || "Error sending invitation");
    }
    return data as { success?: boolean; warning?: string } | null;
  };

  /**
   * Adding a colleague who is already in the workspace goes by USER ID, not by
   * email: POST /api/teams/:id/members is the insider path, it verifies the
   * target already holds a contributor seat here, and it can never become the
   * side door the by-email route used to be. Routing the picker through the
   * email route also meant a teammate with no address on file could be listed
   * and then refused — the row was right there, and the only thing missing was
   * a detail the caller shouldn't have needed.
   */
  const handleAddPerson = async (person: WorkspacePerson) => {
    setAddingId(person.id);
    try {
      const res = await fetch(`/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: person.id }),
      });
      const data = await res.json().catch(() => null);
      // The route says exactly what went wrong ("Only team leads or workspace
      // admins can manage members", "This team is archived…"). Keep it.
      if (!res.ok) {
        throw new Error(data?.error || "Couldn't add teammate");
      }
      const who = person.name || person.email || "Teammate";
      toast.success(
        Array.isArray(data?.alreadyMembers) && data.alreadyMembers.length > 0
          ? `${who} is already on this team`
          : `${who} added to the team`
      );
      setAddedIds((prev) => [...prev, person.id]);
      onInviteSent?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Couldn't add teammate"
      );
    } finally {
      setAddingId(null);
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Enter an email address");
      return;
    }

    setIsLoading(true);
    const address = email.trim();

    try {
      const data = await inviteByEmail(address);
      // Three different successes: an existing user is added to the team
      // outright, an invitation email goes out, or the invitation is
      // saved but the email failed. Saying "Invitation sent" for all
      // three had people waiting for mail that was never sent.
      if (data?.success) {
        toast.success("Added to the team");
      } else if (data?.warning) {
        toast.warning(data.warning);
      } else {
        toast.success(`Invitation sent to ${address}`);
      }
      setEmail("");
      onInviteSent?.();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Error sending invitation"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !isLoading) {
      handleInvite();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add to team</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {/* ── Workspace picker — the common case first ─────────── */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Add from your workspace
            </label>

            {people === null ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            ) : peopleError ? (
              <div className="rounded-lg border p-4 text-center">
                <p className="text-xs text-gray-600 mb-2">
                  Couldn&apos;t load your workspace members.
                </p>
                <Button size="sm" variant="outline" onClick={loadPeople}>
                  Retry
                </Button>
              </div>
            ) : (
              <>
                {/* The search box only earns its space once the list is
                    long enough to scroll — this firm has three people. */}
                {(people.length > 6 || term.length > 0) && (
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                      value={peopleSearch}
                      onChange={(e) => setPeopleSearch(e.target.value)}
                      placeholder="Search people…"
                      className="pl-8 h-9"
                    />
                  </div>
                )}

                {candidates.length === 0 ? (
                  <p className="rounded-lg border border-dashed px-3 py-4 text-xs text-gray-500 text-center">
                    {term
                      ? "Nobody in your workspace matches that."
                      : "Everyone in your workspace is already on this team. Invite someone new by email below."}
                  </p>
                ) : (
                  <div className="max-h-52 overflow-y-auto rounded-lg border divide-y">
                    {candidates.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2"
                      >
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarImage src={p.image || undefined} />
                          <AvatarFallback className="text-[11px] bg-gray-100 text-black">
                            {(p.name || p.email || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-gray-900 truncate">
                            {p.name || p.email}
                          </p>
                          {p.name && p.email && (
                            <p className="text-[11px] text-gray-500 truncate">
                              {p.email}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 flex-shrink-0"
                          disabled={addingId !== null}
                          onClick={() => handleAddPerson(p)}
                        >
                          {addingId === p.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                              Add
                            </>
                          )}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">or</span>
            </div>
          </div>

          {/* Email invite — for people who aren't in the workspace yet */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Invite by email
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="pl-10"
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleInvite} disabled={!email.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Invite"
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              For someone who isn&apos;t in this workspace yet — they get an
              emailed invitation to the workspace and to this team.
            </p>
          </div>

          {/* Copy link */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Share invite link
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  value={inviteLink}
                  readOnly
                  className="pl-10 bg-gray-50 text-gray-600"
                />
              </div>
              <Button variant="outline" onClick={handleCopyLink} className="px-3">
                {copied ? (
                  <Check className="h-4 w-4 text-black" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {teamInviteLinkCaption(privacy)}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
