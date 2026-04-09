"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Send, Loader2 } from "lucide-react";

interface Message {
  id: string;
  content: string;
  senderId: string;
  senderName: string;
  senderImage: string | null;
  createdAt: string;
  read: boolean;
}

interface MessageThreadProps {
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  projectId: string | null;
  projectName: string | null;
  currentUserId: string;
  onBack: () => void;
}

export function MessageThread({
  otherUserId,
  otherUserName,
  otherUserImage,
  projectId,
  projectName,
  currentUserId,
  onBack,
}: MessageThreadProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const otherInitials = otherUserName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [otherUserId, projectId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        otherUserId,
        ...(projectId ? { projectId } : {}),
      });
      const res = await fetch(`/api/client/messages?${params}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);

        // Mark unread messages as read
        const unreadIds = (data.messages || [])
          .filter((m: Message) => m.senderId !== currentUserId && !m.read)
          .map((m: Message) => m.id);

        for (const id of unreadIds) {
          fetch(`/api/client/messages/${id}/read`, { method: "PATCH" });
        }
      }
    } catch (error) {
      console.error("Failed to fetch messages:", error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSend() {
    if (!newMessage.trim()) return;

    setSending(true);
    try {
      const res = await fetch("/api/client/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: newMessage.trim(),
          receiverId: otherUserId,
          projectId,
        }),
      });

      if (res.ok) {
        setNewMessage("");
        fetchMessages();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setSending(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <Card className="flex flex-col border-white/10 bg-[#151515] h-[calc(100vh-12rem)]">
      {/* Thread header */}
      <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          className="text-white/50 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Avatar className="h-8 w-8">
          <AvatarImage src={otherUserImage || undefined} />
          <AvatarFallback className="bg-white/10 text-white text-xs">
            {otherInitials}
          </AvatarFallback>
        </Avatar>
        <div>
          <p className="text-sm font-medium text-white">{otherUserName}</p>
          {projectName && (
            <p className="text-xs text-white/40">{projectName}</p>
          )}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-auto p-5 space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-white/30" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-white/40 text-sm">
              No messages yet. Start the conversation.
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isOwn = msg.senderId === currentUserId;
            const initials = msg.senderName
              .split(" ")
              .map((n) => n[0])
              .join("")
              .toUpperCase()
              .slice(0, 2);

            return (
              <div
                key={msg.id}
                className={`flex gap-3 ${isOwn ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-7 w-7 flex-shrink-0">
                  <AvatarImage src={msg.senderImage || undefined} />
                  <AvatarFallback className={`text-[10px] ${isOwn ? "bg-[#c9a84c] text-black" : "bg-white/10 text-white"}`}>
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[70%] ${isOwn ? "text-right" : ""}`}>
                  <div
                    className={`inline-block rounded-2xl px-4 py-2 text-sm ${
                      isOwn
                        ? "bg-[#c9a84c] text-black rounded-tr-sm"
                        : "bg-white/5 text-white rounded-tl-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                  <p className="mt-1 text-[10px] text-white/30">
                    {new Date(msg.createdAt).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Input */}
      <div className="border-t border-white/10 p-4">
        <div className="flex gap-2">
          <Textarea
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="min-h-[40px] max-h-[120px] resize-none border-white/10 bg-[#0a0a0a] text-white placeholder:text-white/30 focus-visible:ring-[#c9a84c]/30"
          />
          <Button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-[#c9a84c] text-black hover:bg-[#b8973f] px-4"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
