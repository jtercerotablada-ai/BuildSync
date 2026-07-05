"use client";

/**
 * ProjectShareDialog — the real "Share {project}" modal (Asana parity).
 *
 * Mirrors PortfolioShareDialog, adapted to the project's four NATIVE
 * ProjectRole values (ADMIN / EDITOR / COMMENTER / VIEWER) so there's
 * NO lossy role mapping. Wired end-to-end to the members + project APIs
 * (no placeholders):
 *   • Invite by email OR pick a workspace user from a typeahead, with a
 *     role Select (Admin / Editor / Commenter / Viewer) that shows the
 *     one-line description under each option (matches the observed Asana
 *     dialog). An email that isn't a workspace member yet gets a real
 *     emailed invitation that binds this project on accept ("Invitation
 *     sent to {email}"). → POST /api/projects/:id/members
 *   • "Notify when tasks are added to this project" → per-user preference
 *     persisted via useUiState('projectNotifyOnTasks') keyed by project
 *     id (no backing server column — memory forbids schema changes).
 *   • Workspace-access row ("My workspace") → PATCH /api/projects/:id
 *     { visibility } (Private / Workspace / Public). Gated on canEdit.
 *   • "Who has access" list → per-row role dropdown (4 roles + Remove),
 *     PATCH { userId, role } / DELETE ?userId=. The owner row is locked.
 *   • "This project is connected to N portfolio(s)." line, sourced from
 *     GET /api/projects/:id (connectedPortfolios).
 *   • "Copy project link" → navigator.clipboard.writeText.
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
import { toast } from "sonner";
import { useUiState } from "@/hooks/use-ui-state";
import { PROJECT_ROLE_META, type ProjectRole } from "@/lib/people-types";

// ── Types ───────────────────────────────────────────────────

type ProjectVisibility = "PRIVATE" | "WORKSPACE" | "PUBLIC";

interface MemberUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface MemberRow {
  id: string;
  role: ProjectRole;
  userId: string;
  user: MemberUser;
}

interface WorkspaceUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface ConnectedPortfolio {
  id: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  visibility: ProjectVisibility;
  /** The Project.ownerId — its row is locked in the access list. */
  ownerId: string | null;
  /** Whether the current viewer may edit content (visibility / copy link).
   *  Owner or an ADMIN/EDITOR member — mirrors the project PATCH gate. */
  canEdit: boolean;
  /**
   * Whether the current viewer may MANAGE MEMBERS (invite / change role /
   * remove): project owner or a member whose role is ADMIN. This mirrors
   * the members API's admin gate so the invite box / role dropdowns /
   * Remove stay hidden from non-admins instead of showing controls the
   * API will 403.
   */
  canManageMembers: boolean;
  /** Push a visibility change back to the page so its state stays in sync. */
  onVisibilityChange: (visibility: ProjectVisibility) => void;
}

// All four native ProjectRole values, in Asana's display order. Used for
// both the invite Select and the per-row dropdown — no lossy mapping.
const ROLE_ORDER: ProjectRole[] = ["ADMIN", "EDITOR", "COMMENTER", "VIEWER"];

const VISIBILITY_META: Record<
  ProjectVisibility,
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

function roleLabel(role: ProjectRole): string {
  return PROJECT_ROLE_META[role]?.label ?? role;
}

function displayName(u: { name: string | null; email: string | null }): string {
  return u.name || u.email || "Unknown";
}

export function ProjectShareDialog({
  open,
  onOpenChange,
  projectId,
  projectName,
  visibility,
  ownerId,
  canEdit,
  canManageMembers,
  onVisibilityChange,
}: Props) {
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [workspaceUsers, setWorkspaceUsers] = useState<WorkspaceUser[]>([]);
  const [connectedPortfolios, setConnectedPortfolios] = useState<
    ConnectedPortfolio[]
  >([]);

  // Invite form state.
  const [inviteQuery, setInviteQuery] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<ProjectRole>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // "Notify when tasks are added" — per-user pref keyed by project.
  const { value: notifyPrefs, setValue: setNotifyPrefs } = useUiState<
    Record<string, boolean>
  >("projectNotifyOnTasks", {});
  const notifyOnTasks = notifyPrefs[projectId] ?? false;

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/members`);
      if (res.ok) {
        const data = (await res.json()) as MemberRow[];
        setMembers(data);
      }
    } catch (err) {
      console.error("Error fetching project members:", err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

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

  const fetchConnectedPortfolios = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}`);
      if (res.ok) {
        const data = (await res.json()) as {
          connectedPortfolios?: ConnectedPortfolio[];
        };
        setConnectedPortfolios(
          Array.isArray(data.connectedPortfolios)
            ? data.connectedPortfolios
            : []
        );
      }
    } catch (err) {
      console.error("Error fetching connected portfolios:", err);
    }
  }, [projectId]);

  useEffect(() => {
    if (open) {
      fetchMembers();
      fetchWorkspaceUsers();
      fetchConnectedPortfolios();
    }
  }, [open, fetchMembers, fetchWorkspaceUsers, fetchConnectedPortfolios]);

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
    // Prefer an explicitly picked user; otherwise treat the query as an
    // email (the server resolves it against workspace membership).
    const payload: {
      userId?: string;
      email?: string;
      role: ProjectRole;
    } = { role: inviteRole };
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
      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        // Persist the notify preference alongside the invite.
        setNotifyPrefs((prev) => ({ ...prev, [projectId]: notifyOnTasks }));
        // Two shapes come back: an existing member is added immediately
        // (MemberRow), while a non-member email gets a pending emailed
        // invitation ({ invited: true, ... }).
        const result = (await res.json().catch(() => ({}))) as {
          invited?: boolean;
          warning?: string;
        };
        if (result.invited) {
          toast.success(
            result.warning
              ? `Invitation saved for ${payload.email}, but the email couldn't be sent.`
              : `Invitation sent to ${payload.email}`
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

  async function handleRoleChange(userId: string, role: ProjectRole) {
    try {
      const res = await fetch(`/api/projects/${projectId}/members`, {
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
        `/api/projects/${projectId}/members?userId=${encodeURIComponent(
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

  async function handleVisibilityChange(next: ProjectVisibility) {
    if (next === visibility) return;
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ visibility: next }),
      });
      if (res.ok) {
        onVisibilityChange(next);
        toast.success("Workspace access updated");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to update access");
      }
    } catch (err) {
      console.error("Error updating visibility:", err);
      toast.error("Failed to update access");
    }
  }

  async function handleCopyLink() {
    try {
      const url = typeof window !== "undefined" ? window.location.href : "";
      await navigator.clipboard.writeText(url);
      toast.success("Project link copied");
    } catch {
      toast.error("Couldn't copy the link");
    }
  }

  // De-dupe the owner from the members list — project creation inserts the
  // owner as an ADMIN ProjectMember, so the fetched list contains them too.
  // We still show them, but only once (the owner row renders locked).
  const accessRows = members;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="truncate">Share {projectName}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-1">
          {/* Invite by email / person — member management is admin-only
              (project owner or member role ADMIN), matching the API. */}
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
                <Select
                  value={inviteRole}
                  onValueChange={(v) => setInviteRole(v as ProjectRole)}
                >
                  {/* Render the selected label ourselves (not via SelectValue)
                      so the trigger stays a clean single line while each option
                      below carries the Asana one-line role description. */}
                  <SelectTrigger className="h-9 w-full sm:w-40">
                    <span className="truncate">
                      {PROJECT_ROLE_META[inviteRole].label}
                    </span>
                  </SelectTrigger>
                  <SelectContent className="max-w-[16rem]">
                    {ROLE_ORDER.map((role) => (
                      <SelectItem
                        key={role}
                        value={role}
                        textValue={PROJECT_ROLE_META[role].label}
                      >
                        {/* div (not span) so shadcn's `*:[span]:last:flex
                            items-center` rule doesn't flip this to a row. */}
                        <div className="flex flex-col">
                          <span className="text-sm">
                            {PROJECT_ROLE_META[role].label}
                          </span>
                          <span className="text-xs text-gray-500">
                            {PROJECT_ROLE_META[role].description}
                          </span>
                        </div>
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
                  checked={notifyOnTasks}
                  onCheckedChange={(v) =>
                    setNotifyPrefs((prev) => ({
                      ...prev,
                      [projectId]: v === true,
                    }))
                  }
                  className="mt-0.5"
                />
                <span className="text-sm text-gray-700">
                  Notify me when tasks are added to this project
                </span>
              </label>
            </div>
          )}

          {/* Workspace access level ("My workspace") */}
          <div className="rounded-lg border p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8 h-8 rounded-md bg-gray-100 flex items-center justify-center text-gray-500 flex-shrink-0">
                  {VISIBILITY_META[visibility].icon}
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900">
                    My workspace
                  </div>
                  <div className="text-xs text-gray-500 truncate">
                    {VISIBILITY_META[visibility].hint}
                  </div>
                </div>
              </div>
              {canEdit ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="inline-flex items-center gap-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md px-2 py-1 flex-shrink-0">
                      {VISIBILITY_META[visibility].label}
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    {(
                      ["PRIVATE", "WORKSPACE", "PUBLIC"] as ProjectVisibility[]
                    ).map((v) => (
                      <DropdownMenuItem
                        key={v}
                        onClick={() => handleVisibilityChange(v)}
                        className="flex items-start gap-2"
                      >
                        <span className="text-gray-500 mt-0.5">
                          {VISIBILITY_META[v].icon}
                        </span>
                        <span className="flex-1">
                          <span className="block text-sm">
                            {VISIBILITY_META[v].label}
                          </span>
                          <span className="block text-xs text-gray-500">
                            {VISIBILITY_META[v].hint}
                          </span>
                        </span>
                        {v === visibility && (
                          <Check className="h-4 w-4 text-[#a8893a] mt-0.5" />
                        )}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <span className="text-sm text-gray-500 flex-shrink-0">
                  {VISIBILITY_META[visibility].label}
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
                          {isRowOwner ? "Admin" : roleLabel(m.role)}
                        </span>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="inline-flex items-center gap-1 text-sm text-gray-700 hover:bg-gray-100 rounded-md px-2 py-1 flex-shrink-0">
                              {roleLabel(m.role)}
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-64">
                            {ROLE_ORDER.map((role) => (
                              <DropdownMenuItem
                                key={role}
                                onClick={() =>
                                  handleRoleChange(m.user.id, role)
                                }
                                className="flex items-start gap-2"
                              >
                                <span className="flex-1">
                                  <span className="block text-sm">
                                    {PROJECT_ROLE_META[role].label}
                                  </span>
                                  <span className="block text-xs text-gray-500">
                                    {PROJECT_ROLE_META[role].description}
                                  </span>
                                </span>
                                {m.role === role && (
                                  <Check className="h-4 w-4 text-[#a8893a] mt-0.5" />
                                )}
                              </DropdownMenuItem>
                            ))}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-black"
                              onClick={() => handleRemove(m.user.id)}
                            >
                              Remove from project
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

          {/* Connected portfolios */}
          {connectedPortfolios.length > 0 && (
            <div className="text-xs text-gray-500">
              This project is connected to {connectedPortfolios.length}{" "}
              {connectedPortfolios.length === 1 ? "portfolio" : "portfolios"}
              {": "}
              {connectedPortfolios.map((p, i) => (
                <span key={p.id}>
                  {i > 0 && ", "}
                  <a
                    href={`/portfolios/${p.id}`}
                    className="text-gray-700 hover:text-[#a8893a] underline decoration-dotted"
                  >
                    {p.name}
                  </a>
                </span>
              ))}
              .
            </div>
          )}

          {/* Copy link */}
          <div className="border-t pt-3">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleCopyLink}
            >
              <LinkIcon className="h-4 w-4 mr-2" />
              Copy project link
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
