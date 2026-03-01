"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  Send,
  Paperclip,
  Smile,
  MoreHorizontal,
  Pin,
  Trash2,
  Loader2,
  Pencil,
  X,
  Check,
  FileIcon,
  Download,
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

interface Reaction {
  emoji: string;
  count: number;
  hasReacted: boolean;
}

interface MessageAttachment {
  id: string;
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

interface Message {
  id: string;
  content: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
  reactions: Reaction[];
  attachments?: MessageAttachment[];
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

const QUICK_EMOJIS = [
  "👍",
  "❤️",
  "😂",
  "🎉",
  "🔥",
  "👏",
  "🚀",
  "✅",
];

const FULL_EMOJIS = [
  "😀","😂","😍","🎉","👍","👏","🔥","💪",
  "✅","❤️","🚀","💡","⭐","🎯","📌","💬",
  "👋","🙌","😊","🤔","😎","🥳","💯","✨",
];

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
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } else if (diffInHours < 48) {
    return "Yesterday";
  } else {
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  }
}

function getDateLabel(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round(
    (today.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function isEdited(msg: Message): boolean {
  if (!msg.updatedAt || !msg.createdAt) return false;
  return new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 1000;
}

export default function TeamMessagesPage() {
  const params = useParams();
  const teamId = params.teamId as string;
  const { data: session } = useSession();
  const currentUserId = (session?.user as { id?: string })?.id;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [team, setTeam] = useState<Team | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactionPickerMessageId, setReactionPickerMessageId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await fetch(`/api/teams/${teamId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch {
      // Silently fail for polling
    }
  }, [teamId]);

  useEffect(() => {
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

    fetchData();
  }, [teamId]);

  // Auto-polling every 5 seconds
  useEffect(() => {
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [fetchMessages]);

  // Track scroll position
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      isAtBottomRef.current = scrollHeight - scrollTop - clientHeight < 50;
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll only if at bottom
  useEffect(() => {
    if (isAtBottomRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if ((!newMessage.trim() && !pendingFile) || isSending) return;

    setIsSending(true);

    try {
      const content = newMessage.trim() || (pendingFile ? `Shared a file: ${pendingFile.name}` : "");
      const res = await fetch(`/api/teams/${teamId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });

      if (res.ok) {
        const message = await res.json();

        // Upload attachment if pending
        if (pendingFile) {
          const formData = new FormData();
          formData.append("file", pendingFile);

          const attachRes = await fetch(
            `/api/teams/${teamId}/messages/${message.id}/attachments`,
            { method: "POST", body: formData }
          );

          if (attachRes.ok) {
            const attachment = await attachRes.json();
            message.attachments = [attachment];
          }

          setPendingFile(null);
        }

        setMessages((prev) => [...prev, message]);
        setNewMessage("");
        isAtBottomRef.current = true;
      } else {
        toast.error("Failed to send message");
      }
    } catch {
      toast.error("Failed to send message");
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
        toast.success("Message deleted");
      } else {
        toast.error("Failed to delete message");
      }
    } catch {
      toast.error("Failed to delete message");
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
          prev.map((m) =>
            m.id === messageId ? { ...m, isPinned: !isPinned } : m
          )
        );
        toast.success(isPinned ? "Message unpinned" : "Message pinned");
      }
    } catch {
      toast.error("Failed to update message");
    }
  }

  async function handleEditMessage(messageId: string) {
    if (!editContent.trim()) return;

    try {
      const res = await fetch(`/api/teams/${teamId}/messages/${messageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent }),
      });

      if (res.ok) {
        const updated = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? { ...m, content: editContent, updatedAt: updated.updatedAt }
              : m
          )
        );
        setEditingMessageId(null);
        setEditContent("");
        toast.success("Message edited");
      } else {
        toast.error("Failed to edit message");
      }
    } catch {
      toast.error("Failed to edit message");
    }
  }

  async function handleToggleReaction(messageId: string, emoji: string) {
    try {
      const res = await fetch(
        `/api/teams/${teamId}/messages/${messageId}/reactions`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emoji }),
        }
      );

      if (res.ok) {
        const updatedReactions = await res.json();
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId ? { ...m, reactions: updatedReactions } : m
          )
        );
      }
    } catch {
      toast.error("Failed to update reaction");
    }

    setReactionPickerMessageId(null);
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!team) {
    return <div>Team not found</div>;
  }

  const pinnedMessages = messages.filter((m) => m.isPinned);

  // Compute date separators
  let lastDateLabel = "";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <TeamHeader team={team} activeTab="messages" />

      <div className="flex-1 flex flex-col max-w-4xl mx-auto w-full px-6 py-8">
        {/* Pinned messages */}
        {pinnedMessages.length > 0 && (
          <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm font-medium text-yellow-800 mb-2">
              <Pin className="h-4 w-4" />
              Pinned messages
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
          <div
            ref={messagesContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-1"
          >
            {messages.length > 0 ? (
              messages.map((message) => {
                const dateLabel = getDateLabel(message.createdAt);
                const showSeparator = dateLabel !== lastDateLabel;
                lastDateLabel = dateLabel;
                const isOwnMessage = message.author.id === currentUserId;
                const isEditing = editingMessageId === message.id;

                return (
                  <div key={message.id}>
                    {/* Date separator */}
                    {showSeparator && (
                      <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 border-t border-gray-200" />
                        <span className="text-xs font-medium text-gray-400">
                          {dateLabel}
                        </span>
                        <div className="flex-1 border-t border-gray-200" />
                      </div>
                    )}

                    <div
                      className={cn(
                        "flex items-start gap-3 group py-1.5",
                        message.isPinned && "bg-yellow-50 -mx-4 px-4 py-2"
                      )}
                    >
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage
                          src={message.author.image || undefined}
                        />
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
                          {isEdited(message) && (
                            <span className="text-xs text-gray-400 italic">
                              (edited)
                            </span>
                          )}
                        </div>

                        {/* Message content or edit mode */}
                        {isEditing ? (
                          <div className="flex items-center gap-2 mt-1">
                            <input
                              type="text"
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleEditMessage(message.id);
                                } else if (e.key === "Escape") {
                                  setEditingMessageId(null);
                                  setEditContent("");
                                }
                              }}
                              className="flex-1 px-3 py-1 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                              autoFocus
                            />
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleEditMessage(message.id)}
                            >
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => {
                                setEditingMessageId(null);
                                setEditContent("");
                              }}
                            >
                              <X className="h-3.5 w-3.5 text-gray-400" />
                            </Button>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-700 mt-0.5 whitespace-pre-wrap">
                            {message.content}
                          </p>
                        )}

                        {/* Attachments */}
                        {message.attachments && message.attachments.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {message.attachments.map((att) => (
                              <a
                                key={att.id}
                                href={att.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-2 bg-gray-50 border rounded-lg hover:bg-gray-100 transition-colors max-w-[260px]"
                              >
                                <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                                <span className="text-xs text-gray-700 truncate flex-1">
                                  {att.name}
                                </span>
                                <Download className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                              </a>
                            ))}
                          </div>
                        )}

                        {/* Reactions */}
                        {message.reactions && message.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {message.reactions.map((reaction) => (
                              <button
                                key={reaction.emoji}
                                onClick={() =>
                                  handleToggleReaction(
                                    message.id,
                                    reaction.emoji
                                  )
                                }
                                className={cn(
                                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors",
                                  reaction.hasReacted
                                    ? "bg-blue-50 border-blue-200 text-blue-700"
                                    : "bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100"
                                )}
                              >
                                <span>{reaction.emoji}</span>
                                <span>{reaction.count}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Message actions */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* Quick react */}
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() =>
                              setReactionPickerMessageId(
                                reactionPickerMessageId === message.id
                                  ? null
                                  : message.id
                              )
                            }
                          >
                            <Smile className="h-3.5 w-3.5" />
                          </Button>

                          {reactionPickerMessageId === message.id && (
                            <>
                              <div
                                className="fixed inset-0 z-10"
                                onClick={() =>
                                  setReactionPickerMessageId(null)
                                }
                              />
                              <div className="absolute bottom-full right-0 mb-1 bg-white border rounded-lg shadow-lg z-20 p-2">
                                <div className="flex gap-0.5">
                                  {QUICK_EMOJIS.map((emoji) => (
                                    <button
                                      key={emoji}
                                      className="w-7 h-7 flex items-center justify-center hover:bg-gray-100 rounded text-sm"
                                      onClick={() =>
                                        handleToggleReaction(
                                          message.id,
                                          emoji
                                        )
                                      }
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                            </>
                          )}
                        </div>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {isOwnMessage && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setEditingMessageId(message.id);
                                  setEditContent(message.content);
                                }}
                              >
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              onClick={() =>
                                handlePinMessage(message.id, message.isPinned)
                              }
                            >
                              <Pin className="h-4 w-4 mr-2" />
                              {message.isPinned ? "Unpin" : "Pin"}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => handleDeleteMessage(message.id)}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-12">
                <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                  <Send className="h-8 w-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No messages yet
                </h3>
                <p className="text-sm text-gray-500">
                  Be the first to send a message to the team
                </p>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Message input */}
          <form onSubmit={handleSendMessage} className="border-t p-4 relative">
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <>
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setShowEmojiPicker(false)}
                />
                <div className="absolute bottom-full right-16 mb-2 bg-white border rounded-lg shadow-lg z-20 p-3">
                  <div className="grid grid-cols-8 gap-1">
                    {FULL_EMOJIS.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-lg"
                        onClick={() => {
                          setNewMessage((prev) => prev + emoji);
                          setShowEmojiPicker(false);
                          inputRef.current?.focus();
                        }}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Pending file preview */}
            {pendingFile && (
              <div className="flex items-center gap-2 mb-2 px-2 py-1.5 bg-gray-50 border rounded-lg text-sm">
                <FileIcon className="h-4 w-4 text-gray-500 flex-shrink-0" />
                <span className="truncate flex-1 text-gray-700">{pendingFile.name}</span>
                <span className="text-xs text-gray-400 flex-shrink-0">
                  {(pendingFile.size / 1024).toFixed(0)} KB
                </span>
                <button
                  type="button"
                  onClick={() => setPendingFile(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <div className="flex items-center gap-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    if (file.size > 10 * 1024 * 1024) {
                      toast.error("File size exceeds 10MB limit");
                      return;
                    }
                    setPendingFile(file);
                  }
                  e.target.value = "";
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", pendingFile && "text-blue-600")}
                onClick={() => fileInputRef.current?.click()}
              >
                <Paperclip className="h-4 w-4" />
              </Button>

              <input
                ref={inputRef}
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Write a message..."
                className="flex-1 px-4 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={isSending}
              />

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className={cn("h-8 w-8", showEmojiPicker && "bg-gray-100")}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              >
                <Smile className="h-4 w-4" />
              </Button>

              <Button
                type="submit"
                size="icon"
                className="h-8 w-8 rounded-full"
                disabled={(!newMessage.trim() && !pendingFile) || isSending}
              >
                {isSending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
