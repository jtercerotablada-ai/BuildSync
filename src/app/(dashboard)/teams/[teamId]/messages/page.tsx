"use client";

import { useState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import {
  Send,
  Paperclip,
  Smile,
  MoreHorizontal,
  Pin,
  Trash2,
  Loader2,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TeamHeader } from "@/components/teams/team-header";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

interface Team {
  id: string;
  name: string;
  avatar: string | null;
  members: Array<{
    id: string;
    user: {
      id: string;
      name: string | null;
      email: string | null;
      image: string | null;
    };
  }>;
}

function getInitials(name: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffInHours < 24) {
    return date.toLocaleTimeString("es-ES", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffInHours < 48) {
    return "Ayer";
  } else {
    return date.toLocaleDateString("es-ES", {
      month: "short",
      day: "numeric",
    });
  }
}

export default function TeamMessagesPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [team, setTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  useEffect(() => {
    fetchData();
  }, [teamId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  async function fetchData() {
    try {
      const [teamRes, messagesRes] = await Promise.all([
        fetch(`/api/teams/${teamId}`),
        fetch(`/api/teams/${teamId}/messages`),
      ]);

      if (teamRes.ok) {
        const teamData = await teamRes.json();
        setTeam(teamData);
      }

      if (messagesRes.ok) {
        const messagesData = await messagesRes.json();
        setMessages(messagesData);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function scrollToBottom() {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!newMessage.trim() || isSending) return;

    setIsSending(true);

    try {
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });

      if (res.ok) {
        const message = await res.json();
        setMessages((prev) => [...prev, message]);
        setNewMessage("");
      } else {
        toast.error("Error al enviar mensaje");
      }
    } catch (error) {
      toast.error("Error al enviar mensaje");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDeleteMessage(messageId: string) {
    try {
      const res = await fetch(`/api/teams/${teamId}/messages/${messageId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
        toast.success("Mensaje eliminado");
      } else {
        toast.error("Error al eliminar mensaje");
      }
    } catch (error) {
      toast.error("Error al eliminar mensaje");
    }
  }

  async function handlePinMessage(messageId: string, isPinned: boolean) {
    try {
      const res = await fetch(`/api/teams/${teamId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPinned: !isPinned }),
      });

      if (res.ok) {
        setMessages((prev) =>
          prev.map((m) => (m.id === messageId ? { ...m, isPinned: !isPinned } : m))
        );
        toast.success(isPinned ? "Mensaje desanclado" : "Mensaje anclado");
      }
    } catch (error) {
      toast.error("Error al actualizar mensaje");
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return <div>Equipo no encontrado</div>;
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TeamHeader team={team} activeTab="messages" />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-8">
        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 mb-2">
              <Pin className="h-4 w-4" />
              Mensajes anclados
            </div>
            <div className="space-y-2">
              {pinnedMessages.map((message) => (
                <div
                  key={message.id}
                  className="text-sm text-yellow-700 truncate"
                >
                  <span className="font-medium">{message.author.name}:</span>{" "}
                  {message.content}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Messages container */}
        <div className="flex-1 bg-white border rounded-xl overflow-hidden flex flex-col">
          {/* Messages list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length > 0 ? (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex items-start gap-3 group",
                    message.isPinned && "bg-yellow-50 -mx-4 px-4 py-2"
                  )}
                >
                  <Avatar className="h-8 w-8 flex-shrink-0">
                    <AvatarImage src={message.author.image || undefined} />
                    <AvatarFallback className="bg-purple-100 text-purple-700 text-xs">
                      {getInitials(message.author.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm text-gray-900">
                        {message.author.name}
                      </span>
                      <span className="text-xs text-gray-400">
                        {formatMessageTime(message.createdAt)}
                      </span>
                      {message.isPinned && (
                        <Pin className="h-3 w-3 text-yellow-600" />
                      )}
                    </div>
                    <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                      {message.content}
                    </p>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() =>
                          handlePinMessage(message.id, message.isPinned)
                        }
                      >
                        <Pin className="h-4 w-4 mr-2" />
                        {message.isPinned ? "Desanclar" : "Anclar"}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleDeleteMessage(message.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Send className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay mensajes aun
                </h3>
                <p className="text-sm text-gray-500">
                  Se el primero en enviar un mensaje al equipo
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form
            onSubmit={handleSendMessage}
            className="border-t p-4 flex items-center gap-2"
          >
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
              <Paperclip className="h-4 w-4" />
            </Button>

            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder="Escribe un mensaje..."
              className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={isSending}
            />

            <Button type="button" variant="ghost" size="icon" className="h-8 w-8">
              <Smile className="h-4 w-4" />
            </Button>

            <Button
              type="submit"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!newMessage.trim() || isSending}
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
