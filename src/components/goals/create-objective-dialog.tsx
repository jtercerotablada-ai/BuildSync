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
import { Checkbox } from "@/components/ui/checkbox";
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
import { X, Users, Info, Lightbulb, Globe, Lock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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

const TIME_PERIODS = [
  { id: "Q1_FY26", name: "Q1 FY26", startDate: "Jan 1", endDate: "Mar 31" },
  { id: "Q2_FY26", name: "Q2 FY26", startDate: "Apr 1", endDate: "Jun 30" },
  { id: "Q3_FY26", name: "Q3 FY26", startDate: "Jul 1", endDate: "Sep 30" },
  { id: "Q4_FY26", name: "Q4 FY26", startDate: "Oct 1", endDate: "Dec 31" },
  { id: "FY26", name: "FY26", startDate: "Jan 1", endDate: "Dec 31" },
];

export function CreateObjectiveDialog({
  open,
  onOpenChange,
  onObjectiveCreated,
}: CreateObjectiveDialogProps) {
  const router = useRouter();
  const { data: session } = useSession();
  const [loading, setLoading] = useState(false);

  // Form state
  const [title, setTitle] = useState("");
  const [owner, setOwner] = useState<User | null>(null);
  const [accountableTeam, setAccountableTeam] = useState<Team | null>(null);
  const [notifyMembers, setNotifyMembers] = useState(true);
  const [timePeriod, setTimePeriod] = useState("Q1_FY26");
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

  // Fetch teams
  useEffect(() => {
    async function fetchTeams() {
      try {
        const res = await fetch("/api/teams/list");
        if (res.ok) {
          const data = await res.json();
          setTeams(data);
          if (data.length > 0 && !accountableTeam) {
            setAccountableTeam(data[0]);
          }
        }
      } catch (error) {
        console.error("Failed to fetch teams:", error);
      }
    }
    if (open) fetchTeams();
  }, [open]);

  // Fetch workspace users
  useEffect(() => {
    async function fetchUsers() {
      try {
        const res = await fetch("/api/users/search?limit=10");
        if (res.ok) {
          const data = await res.json();
          setUsers(data);
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
      const selectedPeriod = TIME_PERIODS.find((p) => p.id === timePeriod);

      const response = await fetch("/api/objectives", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: title,
          ownerId: owner?.id,
          teamId: accountableTeam?.id,
          period: selectedPeriod?.name,
          privacy,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to create goal");
      }

      const objective = await response.json();
      toast.success("Goal created successfully");
      onOpenChange(false);
      resetForm();
      onObjectiveCreated?.();
      router.push(`/goals/${objective.id}`);
    } catch (error) {
      toast.error("Failed to create goal");
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTitle("");
    setNotifyMembers(true);
    setTimePeriod("Q1_FY26");
    setPrivacy("public");
  };

  const getInitials = (name: string | null) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const selectedPeriod = TIME_PERIODS.find((p) => p.id === timePeriod);

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
                Goal title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="title"
                placeholder="Enter goal title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="focus-visible:ring-purple-500"
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
                          <AvatarFallback className="bg-pink-500 text-white text-xs">
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
                            <AvatarFallback className="bg-pink-500 text-white text-xs">
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
                  value={accountableTeam?.id || ""}
                  onValueChange={(value) => {
                    const team = teams.find((t) => t.id === value);
                    if (team) setAccountableTeam(team);
                  }}
                >
                  <SelectTrigger className="h-10">
                    {accountableTeam ? (
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-500" />
                        <span className="truncate">{accountableTeam.name}</span>
                      </div>
                    ) : (
                      <SelectValue placeholder="Select team" />
                    )}
                  </SelectTrigger>
                  <SelectContent>
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

            {/* Members */}
            <div className="space-y-2">
              <div className="flex items-center gap-1">
                <Label className="text-sm text-gray-700">Members</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-gray-400 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Add team members who will contribute to this goal</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-10 border rounded-md flex items-center px-3 bg-gray-50">
                  {accountableTeam && (
                    <div className="flex items-center gap-2 bg-gray-100 rounded-full px-2 py-1 text-sm">
                      <Users className="h-3.5 w-3.5 text-gray-500" />
                      <span className="truncate max-w-[150px]">
                        1 {accountableTeam.name}
                      </span>
                      <button
                        type="button"
                        className="hover:bg-gray-200 rounded-full p-0.5"
                        onClick={() => setAccountableTeam(null)}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
                <Select defaultValue="commenter">
                  <SelectTrigger className="w-[130px] h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="commenter">Commenter</SelectItem>
                    <SelectItem value="editor">Editor</SelectItem>
                    <SelectItem value="owner">Owner</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notify checkbox */}
            <div className="flex items-center gap-2">
              <Checkbox
                id="notify"
                checked={notifyMembers}
                onCheckedChange={(checked) => setNotifyMembers(checked as boolean)}
              />
              <Label
                htmlFor="notify"
                className="text-sm text-gray-700 cursor-pointer"
              >
                Notify new members about joining this goal
              </Label>
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
                    <SelectValue>
                      {selectedPeriod && (
                        <span>
                          {selectedPeriod.name}{" "}
                          <span className="text-gray-400">
                            {selectedPeriod.startDate} – {selectedPeriod.endDate}
                          </span>
                        </span>
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {TIME_PERIODS.map((period) => (
                      <SelectItem key={period.id} value={period.id}>
                        <span>
                          {period.name}{" "}
                          <span className="text-gray-400">
                            {period.startDate} – {period.endDate}
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
                      </div>
                    </SelectItem>
                    <SelectItem value="private">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-gray-500" />
                        <span>Private</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tip */}
            <div className="flex items-start gap-2 p-3 bg-gray-50 rounded-lg">
              <Lightbulb className="h-4 w-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-gray-500">
                <span className="font-medium text-gray-600">BuildSync tip:</span>{" "}
                You can edit these details and progress settings after creating
                this goal
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
