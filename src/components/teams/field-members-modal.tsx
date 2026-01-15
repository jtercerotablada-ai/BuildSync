"use client";

import { useState } from "react";
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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Info, Users, AlertTriangle } from "lucide-react";

interface FieldMember {
  id: string;
  name: string;
  email?: string;
  image?: string;
  type: "group" | "user";
  role: "admin" | "user";
}

interface FieldMembersModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  organizationName?: string;
  members?: FieldMember[];
}

export function FieldMembersModal({
  open,
  onClose,
  onBack,
  organizationName = "your organization",
  members = [],
}: FieldMembersModalProps) {
  const [inviteEmail, setInviteEmail] = useState("");

  // Default members if none provided
  const defaultMembers: FieldMember[] = [
    {
      id: "1",
      name: "Item administrators (Team)",
      type: "group",
      role: "admin",
    },
    {
      id: "2",
      name: "Guests",
      type: "group",
      role: "user",
    },
  ];

  const displayMembers = members.length > 0 ? members : defaultMembers;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="flex flex-row items-center gap-2">
          {onBack && (
            <button
              onClick={onBack}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          <DialogTitle>Field members</DialogTitle>
        </DialogHeader>

        {/* Visibility info */}
        <p className="text-sm text-gray-600">
          This field is visible to everyone in {organizationName}.
        </p>

        {/* Enterprise upgrade banner */}
        <div className="flex items-center justify-between p-3 bg-white border border-black rounded-lg">
          <div className="flex items-center gap-2 text-black">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm">
              Upgrade to Asana Enterprise to edit access permissions.
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="bg-white border-black text-black hover:bg-gray-100"
          >
            Contact Sales
          </Button>
        </div>

        <div className="space-y-4 py-2">
          {/* Invite */}
          <div>
            <Label className="text-sm font-medium">Invite</Label>
            <div className="relative mt-1">
              <Input
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="Add members by name or email..."
                className="pr-10"
              />
              <button className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <Info className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Field access */}
          <div>
            <Label className="text-sm font-medium">Field access</Label>
            <div className="mt-1 flex items-center gap-2 p-3 border rounded-lg bg-gray-50">
              <Users className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">
                Anyone with access to the team
              </span>
            </div>
          </div>

          {/* Field members */}
          <div>
            <Label className="text-sm font-medium">Field members</Label>
            <div className="mt-1 border rounded-lg divide-y">
              {displayMembers.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between p-3"
                >
                  <div className="flex items-center gap-3">
                    {member.type === "group" ? (
                      <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                        <Users className="h-4 w-4 text-gray-500" />
                      </div>
                    ) : (
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.image} />
                        <AvatarFallback className="text-xs bg-white text-black border border-black">
                          {member.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div>
                      <p className="text-sm font-medium">{member.name}</p>
                      {member.email && (
                        <p className="text-xs text-gray-500">{member.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {member.role === "admin" ? (
                      <Select defaultValue="admin">
                        <SelectTrigger className="w-auto border-0 bg-transparent h-8 text-sm text-gray-600">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">Field admin</SelectItem>
                          <SelectItem value="user">User</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <div className="flex items-center gap-1 text-sm text-gray-500">
                        <Info className="h-3 w-3" />
                        <span>User</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
