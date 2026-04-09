"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageSquare } from "lucide-react";
import { MessageThread } from "./message-thread";

interface Thread {
  threadKey: string;
  otherUserId: string;
  otherUserName: string;
  otherUserImage: string | null;
  projectId: string | null;
  projectName: string | null;
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
}

interface Project {
  id: string;
  name: string;
}

interface MessageListProps {
  threads: Thread[];
  projects: Project[];
  currentUserId: string;
}

export function MessageList({
  threads,
  projects,
  currentUserId,
}: MessageListProps) {
  const [selectedThread, setSelectedThread] = useState<Thread | null>(null);

  if (selectedThread) {
    return (
      <MessageThread
        otherUserId={selectedThread.otherUserId}
        otherUserName={selectedThread.otherUserName}
        otherUserImage={selectedThread.otherUserImage}
        projectId={selectedThread.projectId}
        projectName={selectedThread.projectName}
        currentUserId={currentUserId}
        onBack={() => setSelectedThread(null)}
      />
    );
  }

  return (
    <Card className="border-white/10 bg-[#151515]">
      <CardContent className="p-0">
        {threads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <MessageSquare className="h-10 w-10 text-white/20 mb-3" />
            <p className="text-white/50">No messages yet.</p>
            <p className="text-white/30 text-sm mt-1">
              Messages from your project team will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {threads.map((thread) => {
              const initials = thread.otherUserName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase()
                .slice(0, 2);

              return (
                <button
                  key={thread.threadKey}
                  onClick={() => setSelectedThread(thread)}
                  className="flex w-full items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors"
                >
                  <div className="relative">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={thread.otherUserImage || undefined} />
                      <AvatarFallback className="bg-white/10 text-white text-xs">
                        {initials}
                      </AvatarFallback>
                    </Avatar>
                    {thread.unreadCount > 0 && (
                      <div className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#c9a84c] text-[9px] font-bold text-black">
                        {thread.unreadCount}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium text-white truncate">
                        {thread.otherUserName}
                      </p>
                      {thread.projectName && (
                        <Badge className="bg-white/5 text-white/40 border-0 text-[10px] flex-shrink-0">
                          {thread.projectName}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5">
                      {thread.lastMessage}
                    </p>
                  </div>
                  <p className="text-[10px] text-white/30 flex-shrink-0">
                    {new Date(thread.lastMessageAt).toLocaleDateString()}
                  </p>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
