"use client";

import { useState } from "react";
import { X, Mail, Link2, Copy, Check, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

interface InviteTeamModalProps {
  teamId: string;
  open: boolean;
  onClose: () => void;
  onInviteSent?: () => void;
}

export function InviteTeamModal({
  teamId,
  open,
  onClose,
  onInviteSent,
}: InviteTeamModalProps) {
  const [email, setEmail] = useState("");
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const inviteLink =
    typeof window !== "undefined"
      ? `${window.location.origin}/teams/${teamId}/join`
      : "";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      toast.success("Enlace copiado");
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error("Error al copiar el enlace");
    }
  };

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Ingresa un correo electronico");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        throw new Error("Failed to invite");
      }

      toast.success("Invitacion enviada");
      setEmail("");
      onInviteSent?.();
    } catch (error) {
      toast.error("Error al enviar invitacion");
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
          <DialogTitle>Invitar al equipo</DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Email invite */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Invitar por correo electronico
            </label>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="pl-10"
                  onKeyDown={handleKeyDown}
                  disabled={isLoading}
                />
              </div>
              <Button onClick={handleInvite} disabled={!email.trim() || isLoading}>
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Invitar"
                )}
              </Button>
            </div>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">o</span>
            </div>
          </div>

          {/* Copy link */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Compartir enlace de invitacion
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
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Cualquier persona con este enlace podra unirse al equipo
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
