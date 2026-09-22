"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import { Users, Info, Lightbulb, Globe, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToday } from "@/lib/use-today";
import {
  currentQuarterPeriod,
  formatGoalPeriodRange,
  goalPeriodOptions,
} from "@/components/goals/views/types";

interface CreateObjectiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onObjectiveCreated?: () => void;
}

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

interface Team {
  id: string;
  name: string;
}

// Radix Select cannot hold an empty-string value, so "no team" needs a token.
const NO_TEAM = "__none__";

export function CreateObjectiveDialog({
  open,
  onOpenChange,
  onObjectiveCreated,
}: CreateObjectiveDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const today = useToday();
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<User | null>(null);
  const [accountableTeam, setAccountableTeam] = useState<Team | null>(null);
  // Set to the current quarter when the dialog opens (in an effect, so the
  // clock is never read during a server render).
  const [timePeriod, setTimePeriod] = useState("");
  const [privacy, setPrivacy] = useState<"public" | "private">("public");

  // Data
  const [teams, setTeams] = useState<Team[]>([]);
  const [users, setUsers] = useState<User[]>([]);

  // Set current user as default owner
  useEffect(() => {
    if (session?.user && !owner) {
      setOwner({
        id: (session.user as User & { id: string }).id || "",
        name: session.user.name || null,
        email: session.user.email || "",
        image: session.user.image || null,
      });
    }
  }, [session, owner]);

  // Teams of the workspace the goal is created in. /api/teams/list spans
  // every workspace the user belongs to while the create route refuses a
  // team from any other one, so pre-selecting its first entry could make
  // every save fail. Nothing is pre-selected: a team is an explicit choice.
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams");
        if (res.ok) {
          const data = (await res.json()) as Team[];
          setTeams(data.map((t) => ({ id: t.id, name: t.name })));
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    }
    if (open) fetchTeams();
  }, [open]);

  // Owner candidates: contributors of the same workspace, the only people
  // the create route accepts as an owner.
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/team/directory");
        if (res.ok) {
          const data = (await res.json()) as {
            members?: {
              id: string;
              name: string | null;
              email: string | null;
              image: string | null;
              workspaceRole?: string;
            }[];
          };
          setUsers(
            (data.members ?? [])
              .filter(
                (m) =>
                  m.workspaceRole !== "GUEST" && m.workspaceRole !== "CLIENT"
              )
              .map((m) => ({
                id: m.id,
                name: m.name,
                email: m.email ?? "",
                image: m.image,
              }))
          );
        }
      } catch (error) {
        console.error("Failed to fetch users:", error);
      }
    }
    if (open) fetchUsers();
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim()) {
      toast.error("Goal title is required");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title.trim(),
          ownerId: owner?.id,
          teamId: accountableTeam?.id,
          period: timePeriod || undefined,
          // Key results drive the goal's number. Without this the route
          // stores MANUAL and the key results added next never move it.
          progressSource: "KEY_RESULTS",
          // The picker has to arrive as the column the privacy gate reads
          // (Objective.isPrivate). Sent under any other name it is dropped
          // as an unknown key and every goal is created public.
          isPrivate: privacy === "private",
        }),
      });

      if (!response.ok) {
        // The route says why (e.g. "Team not found"); that is the only clue
        // the user has about what to change.
        const err = await response.json().catch(() => null);
        throw new Error(err?.error || "Failed to create goal");
      }

      const objective = await response.json();
      toast.success("Goal created successfully");
      onOpenChange(false);
      resetForm();
      onObjectiveCreated?.();
      router.push(`/goals/${objective.id}`);
    } catch (error) {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : "Failed to create goal"
      );
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setAccountableTeam(null);
    setPrivacy("public");
  };

  // Reset the form when the dialog closes; default the period when it opens.
  useEffect(() => {
    if (open) setTimePeriod(currentQuarterPeriod(new Date()));
    else resetForm();
  }, [open]);

  // This fiscal year and the next; the chosen label is always kept listed.
  const periodOptions = today
    ? goalPeriodOptions(today, { yearsBack: 0, extra: [timePeriod] })
    : timePeriod
      ? [timePeriod]
      : [];

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle className="text-xl">Create a new goal</DialogTitle>
          </DialogHeader>

          <div className="px-6 space-y-5">
            {/* Goal title */}
            <div className="space-y-2">
              <Label htmlFor="title" className="text-sm text-gray-700">
                Goal title <span className="text-black">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter goal title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="focus-visible:ring-[#c9a84c]"
                autoFocus
              />
            </div>

            {/* Goal owner + Accountable team */}
            <div className="grid grid-cols-2 gap-4">
              {/* Goal owner */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700">Goal owner</Label>
                <Select
                  value={owner?.id || ""}
                  onValueChange={(value) => {
                    const user = users.find((u) => u.id === value);
                    if (user) setOwner(user);
                  }}
                >
                  <SelectTrigger className="h-10">
                    {owner ? (
                      <div className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={owner.image || undefined} />
                          <AvatarFallback className="bg-[#c9a84c] text-white text-xs">
                            {getInitials(owner.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{owner.name || owner.email}</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select owner" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage src={user.image || undefined} />
                            <AvatarFallback className="bg-[#c9a84c] text-white text-xs">
                              {getInitials(user.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span>{user.name || user.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Accountable team */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700">
                  Company or accountable team
                </Label>
                <Select
                  value={accountableTeam?.id || NO_TEAM}
                  onValueChange={(value) =>
                    setAccountableTeam(teams.find((t) => t.id === value) ?? null)
                  }
                >
                  <SelectTrigger className="h-10">
                    {accountableTeam ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="truncate">{accountableTeam.name}</span>
                      </div>
                    ) : (
                      <span className="text-gray-500">No team</span>
                    )}
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_TEAM}>
                      <span className="text-gray-500">No team</span>
                    </SelectItem>
                    {teams.map((team) => (
                      <SelectItem key={team.id} value={team.id}>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <span>{team.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Time period + Privacy */}
            <div className="grid grid-cols-2 gap-4">
              {/* Time period */}
              <div className="space-y-2">
                <div className="flex items-center gap-1">
                  <Label className="text-sm text-gray-700">Time period</Label>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-gray-400 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Set the time frame for achieving this goal</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <Select value={timePeriod} onValueChange={setTimePeriod}>
                  <SelectTrigger className="h-10">
                    <SelectValue placeholder="Select period">
                      {timePeriod && (
                        <span>
                          {timePeriod}{" "}
                          <span className="text-gray-400">
                            {formatGoalPeriodRange(timePeriod)}
                          </span>
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {periodOptions.map((period) => (
                      <SelectItem key={period} value={period}>
                        <span>
                          {period}{" "}
                          <span className="text-gray-400">
                            {formatGoalPeriodRange(period)}
                          </span>
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Privacy */}
              <div className="space-y-2">
                <Label className="text-sm text-gray-700">Privacy</Label>
                <Select
                  value={privacy}
                  onValueChange={(value) =>
                    setPrivacy(value as "public" | "private")
                  }
                >
                  <SelectTrigger className="h-10">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {privacy === "public" ? (
                          <Globe className="h-4 w-4 text-gray-500" />
                        ) : (
                          <Lock className="h-4 w-4 text-gray-500" />
                        )}
                        <span className="capitalize">{privacy}</span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="public">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-gray-500" />
                        <span>Public</span>
                        <span className="text-[11px] text-gray-500">
                          Everyone in the workspace
                        </span>
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-500" />
                        <span>Private</span>
                        <span className="text-[11px] text-gray-500">
                          Owner and members only
                        </span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tip */}
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <Lightbulb className="h-4 w-4 text-[#a8893a] mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">Pro tip:</span>{" "}
                You can add members, key results and progress settings after
                creating this goal
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 mt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading || !title.trim()}
              className="bg-gray-900 hover:bg-gray-800"
            >
              {loading ? "Creating..." : "Save goal"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
