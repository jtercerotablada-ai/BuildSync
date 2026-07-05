"use client";

/**
 * PortfolioShareDialog — the real "Share {portfolio}" modal.
 *
 * Wired end-to-end to the members + portfolio APIs (no placeholders):
 *   • Invite by email OR pick a workspace user from a typeahead, with a
 *     role Select (Portfolio admin / Editor / Commenter / Viewer). An
 *     email that isn't a workspace member yet gets a real emailed
 *     invitation that binds this portfolio on accept ("Invitation sent
 *     to {email}"). Roles
 *     map onto the PortfolioRole enum (OWNER / EDITOR / VIEWER):
 *        Portfolio admin → OWNER
 *        Editor          → EDITOR
 *        Commenter       → VIEWER   (read-only; no comment-only role)
 *        Viewer          → VIEWER
 *     → POST /api/portfolios/:id/members
 *   • "Grant access to all projects where I'm project admin" → passes
 *     grantProjectAccess to the POST (server gates per-project).
 *   • "Notify when work is added" → per-user preference persisted via
 *     useUiState('portfolioNotifyOnWork') (no backing server column).
 *   • Workspace-access row ("My workspace") → PATCH /api/portfolios/:id
 *     { privacy } (Private / Workspace / Public).
 *   • "Who has access" list → per-row role dropdown + Remove access,
 *     PATCH { userId, role } / DELETE ?userId=. The owner row is locked.
 *   • "Copy portfolio link" → navigator.clipboard.writeText.
 */

import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Link as LinkIcon,
  ChevronDown,
  Globe,
  Building2,
  Lock,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useUiState } from "@/hooks/use-ui-state";

// ── Types ───────────────────────────────────────────────────

type PortfolioPrivacy = "PRIVATE" | "WORKSPACE" | "PUBLIC";
type PortfolioRole = "OWNER" | "EDITOR" | "VIEWER";

interface MemberUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  jobTitle: string | null;
  position: string | null;
  customTitle: string | null;
}

interface MemberRow {
  id: string;
  role: string; // OWNER | EDITOR | VIEWER | WORKSPACE
  joinedAt: string;
  user: MemberUser;
}

interface WorkspaceUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  portfolioId: string;
  portfolioName: string;
  privacy: PortfolioPrivacy;
  /** The Portfolio.ownerId — its row is locked in the access list. */
  ownerId: string | null;
  /** Whether the current viewer may edit content (privacy / copy link). */
  canEdit: boolean;
  /**
   * Whether the current viewer may MANAGE MEMBERS (invite / change role /
   * remove): portfolio owner or a member whose role is OWNER. Editors are
   * excluded — this mirrors the members API's `canManageMembers` gate, so
   * the invite box / role dropdowns / Remove access stay hidden from them
   * instead of showing controls the API will 403.
   */
  canManageMembers: boolean;
  /** Whether the current viewer is the portfolio owner (can grant OWNER). */
  isOwner: boolean;
  /** Push a privacy change back to the page so its state stays in sync. */
  onPrivacyChange: (privacy: PortfolioPrivacy) => void;
}

// Invite-role options (Asana labels → PortfolioRole).
const INVITE_ROLES: { value: string; role: PortfolioRole; label: string }[] = [
  { value: "admin", role: "OWNER", label: "Portfolio admin" },
  { value: "editor", role: "EDITOR", label: "Editor" },
  { value: "commenter", role: "VIEWER", label: "Commenter" },
  { value: "viewer", role: "VIEWER", label: "Viewer" },
];

// Per-row role options for the "Who has access" dropdown.
const ROW_ROLES: { role: PortfolioRole; label: string }[] = [
  { role: "OWNER", label: "Portfolio admin" },
  { role: "EDITOR", label: "Editor" },
  { role: "VIEWER", label: "Viewer" },
];

const PRIVACY_META: Record<
  PortfolioPrivacy,
  { label: string; hint: string; icon: React.ReactNode }
> = {
  PRIVATE: {
    label: "Private to members",
    hint: "Only invited people can access",
    icon: <Lock className="h-4 w-4" />,
  },
  WORKSPACE: {
    label: "Members with the link",
    hint: "People you invite plus the workspace",
    icon: <Building2 className="h-4 w-4" />,
  },
  PUBLIC: {
    label: "Everyone in the workspace",
    hint: "Anyone in the workspace can view",
    icon: <Globe className="h-4 w-4" />,
  },
};

function roleLabel(role: string): string {
  if (role === "OWNER") return "Portfolio admin";
  if (role === "EDITOR") return "Editor";
  if (role === "VIEWER") return "Viewer";
  if (role === "WORKSPACE") return "Workspace";
  return role;
}

function displayName(u: { name: string | null; email: string | null }): string {
  return u.name || u.email || "Unknown";
}

export function PortfolioShareDialog({
  open,
  onOpenChange,
  portfolioId,
  portfolioName,
  privacy,
  ownerId,
  canEdit,
  canManageMembers,
  isOwner,
  onPrivacyChange,
}: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);

  // Invite form state.
  const [inviteQuery, setInviteQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<string>("editor");
  const [grantProjectAccess, setGrantProjectAccess] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // "Notify when work is added" — per-user pref keyed by portfolio.
  const { value: notifyPrefs, setValue: setNotifyPrefs } = useUiState<
    Record<string, boolean>
  >("portfolioNotifyOnWork", {});
  const notifyOnWork = notifyPrefs[portfolioId] ?? false;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members`);
      if (res.ok) {
        const data = (await res.json()) as MemberRow[];
        setMembers(data);
      }
    } catch (err) {
      console.error("Error fetching portfolio members:", err);
    } finally {
      setLoading(false);
    }
  }, [portfolioId]);

  const fetchWorkspaceUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/workspace/members");
      if (res.ok) {
        const data = await res.json();
        setWorkspaceUsers(
          (Array.isArray(data) ? data : []).map(
            (m: { user: WorkspaceUser }) => m.user
          )
        );
      }
    } catch (err) {
      console.error("Error fetching workspace users:", err);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchWorkspaceUsers();
    }
  }, [open, fetchMembers, fetchWorkspaceUsers]);

  // Ids already in the access list (members + owner) — hidden from the
  // invite typeahead so you can't double-invite.
  const existingAccessIds = new Set(members.map((m) => m.user.id));

  const suggestions = workspaceUsers.filter((u) => {
    if (existingAccessIds.has(u.id)) return false;
    const q = inviteQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      (u.name || "").toLowerCase().includes(q) ||
      (u.email || "").toLowerCase().includes(q)
    );
  });

  async function handleInvite() {
    const roleDef = INVITE_ROLES.find((r) => r.value === inviteRole);
    if (!roleDef) return;

    // Prefer an explicitly picked user; otherwise treat the query as an
    // email (the server resolves it against workspace membership).
    const payload: {
      userId?: string;
      email?: string;
      role: PortfolioRole;
      grantProjectAccess: boolean;
    } = {
      role: roleDef.role,
      grantProjectAccess,
    };
    if (selectedUserId) {
      payload.userId = selectedUserId;
    } else {
      const email = inviteQuery.trim();
      if (!email) {
        toast.error("Enter an email or pick a person to invite");
        return;
      }
      payload.email = email;
    }

    setInviting(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Persist the notify preference alongside the invite.
        setNotifyPrefs((prev) => ({ ...prev, [portfolioId]: notifyOnWork }));
        // Two shapes come back: an existing member is added immediately
        // (MemberRow), while a non-member email gets a pending emailed
        // invitation ({ invited: true, email, message }).
        const result = (await res.json().catch(() => ({}))) as {
          invited?: boolean;
          email?: string;
          message?: string;
        };
        if (result.invited) {
          toast.success(
            result.message ||
              `Invitation sent to ${result.email || "that email"}`
          );
        } else {
          toast.success("Access granted");
        }
        setInviteQuery("");
        setSelectedUserId(null);
        setShowSuggestions(false);
        await fetchMembers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to invite");
      }
    } catch (err) {
      console.error("Error inviting member:", err);
      toast.error("Failed to invite");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(userId: string, role: PortfolioRole) {
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/members`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, role }),
      });
      if (res.ok) {
        toast.success("Role updated");
        await fetchMembers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to update role");
      }
    } catch (err) {
      console.error("Error updating role:", err);
      toast.error("Failed to update role");
    }
  }

  async function handleRemove(userId: string) {
    try {
      const res = await fetch(
        `/api/portfolios/${portfolioId}/members?userId=${encodeURIComponent(
          userId
        )}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        toast.success("Access removed");
        await fetchMembers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to remove access");
      }
    } catch (err) {
      console.error("Error removing access:", err);
      toast.error("Failed to remove access");
    }
  }

  async function handlePrivacyChange(next: PortfolioPrivacy) {
    if (next === privacy) return;
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ privacy: next }),
      });
      if (res.ok) {
        onPrivacyChange(next);
        toast.success("Workspace access updated");
        // PUBLIC vs. others changes the synthesized workspace rows.
        await fetchMembers();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to update access");
      }
    } catch (err) {
      console.error("Error updating privacy:", err);
      toast.error("Failed to update access");
    }
  }

  async function handleCopyLink() {
    try {
      const url =
        typeof window !== "undefined" ? window.location.href : "";
      await navigator.clipboard.writeText(url);
      toast.success("Portfolio link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  // Owner + explicit members only (exclude synthesized WORKSPACE rows
  // from the "who has access" list — those aren't members).
  const accessRows = members.filter((m) => m.role !== "WORKSPACE");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">
            Share {portfolioName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Invite by email / person — member management is admin-only
              (portfolio owner or member role OWNER), matching the API. */}
          {canManageMembers && (
            <div className="space-y-2">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Input
                    value={inviteQuery}
                    onChange={(e) => {
                      setInviteQuery(e.target.value);
                      setSelectedUserId(null);
                      setShowSuggestions(true);
                    }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() =>
                      // Delay so a suggestion click registers first.
                      setTimeout(() => setShowSuggestions(false), 150)
                    }
                    placeholder="Invite by name or email"
                    className="h-9"
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-50 mt-1 w-full max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg">
                      {suggestions.slice(0, 8).map((u) => (
                        <button
                          key={u.id}
                          type="button"
                          onMouseDown={(e) => {
                            // onMouseDown so it fires before input blur.
                            e.preventDefault();
                            setSelectedUserId(u.id);
                            setInviteQuery(displayName(u));
                            setShowSuggestions(false);
                          }}
                          className="w-full flex items-center gap-2 px-2.5 py-2 text-left hover:bg-gray-50"
                        >
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={u.image || ""} />
                            <AvatarFallback className="text-[10px] bg-gray-200">
                              {(u.name || u.email || "?").charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="flex-1 min-w-0">
                            <span className="block text-sm text-gray-800 truncate">
                              {u.name || u.email}
                            </span>
                            {u.name && u.email && (
                              <span className="block text-xs text-gray-400 truncate">
                                {u.email}
                              </span>
                            )}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger className="h-9 w-full sm:w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVITE_ROLES.map((r) => (
                      <SelectItem
                        key={r.value}
                        value={r.value}
                        disabled={r.role === "OWNER" && !isOwner}
                      >
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleInvite}
                  disabled={inviting}
                  className="h-9 bg-black hover:bg-gray-800"
                >
                  {inviting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    "Invite"
                  )}
                </Button>
              </div>

              <label className="flex items-start gap-2 cursor-pointer select-none pt-1">
                <Checkbox
                  checked={grantProjectAccess}
                  onCheckedChange={(v) => setGrantProjectAccess(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  Grant access to all projects in this portfolio where I&apos;m
                  project admin
                </span>
              </label>
              <label className="flex items-start gap-2 cursor-pointer select-none">
                <Checkbox
                  checked={notifyOnWork}
                  onCheckedChange={(v) =>
                    setNotifyPrefs((prev) => ({
                      ...prev,
                      [portfolioId]: v === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  Notify me when work is added to the portfolio
                </span>
              </label>
            </div>
          )}

          {/* Workspace access level ("My workspace") */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                  {PRIVACY_META[privacy].icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    My workspace
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {PRIVACY_META[privacy].hint}
                  </div>
                </div>
              </div>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md px-2 py-1 flex-shrink-0">
                      {PRIVACY_META[privacy].label}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {(
                      ["PRIVATE", "WORKSPACE", "PUBLIC"] as PortfolioPrivacy[]
                    ).map((p) => (
                      <DropdownMenuItem
                        key={p}
                        onClick={() => handlePrivacyChange(p)}
                        className="flex items-start gap-2"
                      >
                        <span className="text-gray-500 mt-0.5">
                          {PRIVACY_META[p].icon}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm">
                            {PRIVACY_META[p].label}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {PRIVACY_META[p].hint}
                          </span>
                        </span>
                        {p === privacy && (
                          <Check className="h-4 w-4 text-[#a8893a] mt-0.5" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-sm text-gray-500 flex-shrink-0">
                  {PRIVACY_META[privacy].label}
                </span>
              )}
            </div>
          </div>

          {/* Who has access */}
          <div>
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Who has access
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
              </div>
            ) : accessRows.length === 0 ? (
              <div className="text-sm text-gray-500 py-4 text-center">
                No one has explicit access yet.
              </div>
            ) : (
              <div className="space-y-1">
                {accessRows.map((m) => {
                  const isRowOwner = m.user.id === ownerId;
                  return (
                    <div
                      key={m.user.id}
                      className="flex items-center gap-2.5 py-1.5"
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={m.user.image || ""} />
                        <AvatarFallback className="text-xs bg-gray-200">
                          {(m.user.name || m.user.email || "?").charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm text-gray-900 truncate">
                          {displayName(m.user)}
                          {isRowOwner && (
                            <span className="ml-1.5 text-xs text-gray-400">
                              (owner)
                            </span>
                          )}
                        </div>
                        {m.user.email && (
                          <div className="text-xs text-gray-400 truncate">
                            {m.user.email}
                          </div>
                        )}
                      </div>
                      {isRowOwner || !canManageMembers ? (
                        <span className="text-sm text-gray-500 flex-shrink-0 px-2">
                          {roleLabel(m.role)}
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md px-2 py-1 flex-shrink-0">
                              {roleLabel(m.role)}
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            {ROW_ROLES.map((r) => (
                              <DropdownMenuItem
                                key={r.role}
                                disabled={r.role === "OWNER" && !isOwner}
                                onClick={() =>
                                  handleRoleChange(m.user.id, r.role)
                                }
                              >
                                <span className="flex-1">{r.label}</span>
                                {m.role === r.role && (
                                  <Check className="h-4 w-4 text-[#a8893a]" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-black"
                              onClick={() => handleRemove(m.user.id)}
                            >
                              Remove access
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Copy link */}
          <div className="border-t pt-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleCopyLink}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Copy portfolio link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
