"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Lock, X, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface SearchUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface ManagePrivacyModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManagePrivacyModal({ open, onOpenChange }: ManagePrivacyModalProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchUser[]>([]);
  const [searching, setSearching] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [selectedUser, setSelectedUser] = useState<SearchUser | null>(null);
  const [showResults, setShowResults] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Valid if we have a selected user or a valid email typed
  const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query.trim());
  const canInvite = selectedUser !== null || isValidEmail;

  const searchUsers = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setShowResults(false);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/users/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data);
        setShowResults(data.length > 0);
      }
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    setSelectedUser(null);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchUsers(value), 250);
  }

  function handleSelectUser(user: SearchUser) {
    setSelectedUser(user);
    setQuery(user.name || user.email || "");
    setShowResults(false);
  }

  async function handleInvite() {
    if (!canInvite) return;
    setInviting(true);

    const email = selectedUser?.email || query.trim();

    try {
      const res = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        toast.success(`Invitación enviada a ${email}`);
        setQuery("");
        setSelectedUser(null);
        setResults([]);
      } else {
        const data = await res.json();
        toast.error(data.error || "No se pudo enviar la invitación");
      }
    } catch {
      toast.error("No se pudo enviar la invitación");
    } finally {
      setInviting(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && canInvite && !showResults) {
      e.preventDefault();
      handleInvite();
    }
  }

  // Close results dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        resultsRef.current &&
        !resultsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset state on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults([]);
      setSelectedUser(null);
      setShowResults(false);
    }
  }, [open]);

  function initials(name: string | null) {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] max-w-[92vw] p-0 rounded-xl border-0 shadow-[0_12px_40px_rgba(0,0,0,0.22)] gap-0 overflow-visible [&>button]:hidden">
        <DialogTitle className="sr-only">Administrar la privacidad</DialogTitle>

        {/* Header */}
        <div className="flex items-center justify-between px-[22px] py-[18px]">
          <h2 className="text-[16px] font-semibold text-gray-900">Administrar la privacidad</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-center w-7 h-7 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-[22px] pb-[22px] space-y-4">
          {/* Search input + invite */}
          <div className="flex items-center gap-2.5">
            <div className="relative flex-1">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => { if (results.length > 0) setShowResults(true); }}
                placeholder="Agrega compañeros de equipo por nombre o por email\u2026"
                className="w-full h-10 px-3 text-[14px] text-gray-800 placeholder:text-gray-400 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black/10 focus:border-gray-300 transition-colors"
              />

              {/* Autocomplete dropdown */}
              {showResults && (
                <div
                  ref={resultsRef}
                  className="absolute left-0 right-0 top-[calc(100%+4px)] bg-white rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.12)] border border-gray-100 py-1 z-50 max-h-[200px] overflow-y-auto"
                >
                  {results.map((user) => (
                    <button
                      key={user.id}
                      onClick={() => handleSelectUser(user)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-black/[0.04] transition-colors text-left"
                    >
                      <Avatar className="h-7 w-7 flex-shrink-0">
                        <AvatarImage src={user.image || ""} />
                        <AvatarFallback className="bg-gray-200 text-gray-600 text-[10px] font-medium">
                          {initials(user.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-medium text-gray-800 truncate">
                          {user.name || "Desconocido"}
                        </p>
                        {user.email && (
                          <p className="text-[12px] text-gray-400 truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={handleInvite}
              disabled={!canInvite || inviting}
              className={cn(
                "h-8 px-4 rounded-lg text-[14px] font-medium border transition-colors flex-shrink-0",
                canInvite && !inviting
                  ? "border-gray-300 text-gray-700 hover:bg-gray-50 cursor-pointer"
                  : "border-gray-200 text-gray-400 opacity-50 cursor-not-allowed"
              )}
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                "Invitar"
              )}
            </button>
          </div>

          {/* Privacy info panel */}
          <div className="flex gap-3 p-3.5 bg-[#f3f4f6] rounded-lg">
            <Lock className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            <p className="text-[13px] text-gray-600 leading-relaxed flex-1">
              Esta vista es privada y solo tú puedes acceder a ella. Si agregas compañeros de equipo, podrán ver, editar y organizar tus tareas. Solo verán las tareas a las que ya tienen acceso.{" "}
              <a
                href="#"
                onClick={(e) => e.preventDefault()}
                className="text-blue-600 hover:text-blue-700 hover:underline"
              >
                Más información
              </a>
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
