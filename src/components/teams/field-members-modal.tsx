"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, ShieldCheck } from "lucide-react";

/**
 * "Field access" — what a team's custom field is visible to.
 *
 * This used to be a mock of a per-field ACL the product does not have: an
 * "Upgrade to TT Enterprise to edit access permissions" banner with a Contact
 * Sales button (BuildSync is the firm's own internal tool — there is no paid
 * tier, and the address it mailed is on a domain with no mail), an Invite
 * field whose only button toasted an instruction, and an uncontrolled role
 * Select that persisted nothing. Same class as the Advanced permissions tab
 * and the "Endorsed / Premium feature" checkbox, both removed.
 *
 * The real rule is one line and it is enforced: a team field belongs to the
 * team, so everyone with access to the team can read and fill it, and only a
 * LEAD can add, rename or delete one (PATCH/DELETE /api/teams/:id/fields).
 * That is what this panel states now.
 */
interface FieldMembersModalProps {
  open: boolean;
  onClose: () => void;
  onBack?: () => void;
  organizationName?: string;
}

export function FieldMembersModal({
  open,
  onClose,
  onBack,
  organizationName = "this team",
}: FieldMembersModalProps) {
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
          <DialogTitle>Field access</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Who can read and fill it */}
          <div>
            <Label className="text-sm font-medium">Who can see this field</Label>
            <div className="mt-1 flex items-start gap-2 p-3 border rounded-lg bg-gray-50">
              <Users className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-600">
                Everyone on {organizationName} can see this field and fill it in
                for any member.
              </span>
            </div>
          </div>

          {/* Who can change the field itself */}
          <div>
            <Label className="text-sm font-medium">Who can change it</Label>
            <div className="mt-1 flex items-start gap-2 p-3 border rounded-lg bg-gray-50">
              <ShieldCheck className="h-4 w-4 mt-0.5 text-gray-500 flex-shrink-0" />
              <span className="text-sm text-gray-600">
                Team leads can rename or delete the field. Deleting it also
                deletes every member&apos;s stored value for it.
              </span>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
