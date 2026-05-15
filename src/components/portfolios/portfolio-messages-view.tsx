"use client";

import { useEffect, useState } from "react";
import { Loader2, Send, MessageSquare } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";

interface Author {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
}

interface PortfolioMessage {
  id: string;
  content: string;
  createdAt: string;
  author: Author | null;
  replyCount: number;
}

interface Props {
  portfolioId: string;
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function PortfolioMessagesView({ portfolioId }: Props) {
  const [messages, setMessages] = useState<PortfolioMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetchMessages();
  }, [portfolioId]);

  async function fetchMessages() {
    setLoading(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/messages`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
      }
    } catch (err) {
      console.error("Error fetching messages:", err);
    } finally {
      setLoading(false);
    }
  }

  async function handlePost() {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: draft.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        setMessages((prev) => [created, ...prev]);
        setDraft("");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to post message");
      }
    } catch (err) {
      console.error("Error posting message:", err);
      toast.error("Failed to post message");
    } finally {
      setPosting(false);
    }
  }

  return (
    <div className="bg-white rounded-lg border max-w-3xl mx-auto">
      {/* Composer */}
      <div className="p-4 border-b">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Send a message to portfolio members..."
          rows={3}
          className="text-sm"
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
              e.preventDefault();
              handlePost();
            }
          }}
        />
        <div className="flex items-center justify-between mt-2">
          <span className="text-[11px] text-gray-400">
            ⌘/Ctrl + Enter to send
          </span>
          <Button
            onClick={handlePost}
            disabled={posting || !draft.trim()}
            className="bg-black hover:bg-gray-800"
            size="sm"
          >
            {posting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4 mr-2" />
                Send
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Feed */}
      <div className="divide-y">
        {loading ? (
          <div className="p-12 flex justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="p-12 text-center">
            <MessageSquare className="h-10 w-10 text-gray-300 mx-auto mb-3" />
            <h3 className="text-base font-medium text-black mb-1">
              Start the conversation
            </h3>
            <p className="text-sm text-gray-500 max-w-md mx-auto">
              Send a message to get things moving, share status across
              projects, or discuss decisions with portfolio members.
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className="p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={m.author?.image || ""} />
                  <AvatarFallback className="text-xs bg-gray-200">
                    {m.author?.name?.charAt(0) || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-medium text-black">
                      {m.author?.name || "Unknown"}
                    </span>
                    <span className="text-xs text-gray-500">
                      {timeAgo(m.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-800 mt-1 whitespace-pre-wrap break-words">
                    {m.content}
                  </p>
                  {m.replyCount > 0 && (
                    <button className="text-xs text-[#a8893a] mt-2 hover:underline">
                      {m.replyCount}{" "}
                      {m.replyCount === 1 ? "reply" : "replies"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
