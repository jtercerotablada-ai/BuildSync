import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { MessageList } from "@/components/client/message-list";

export default async function ClientMessagesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  });

  if (!user) redirect("/login");

  // Get projects the client has access to
  const accesses = await prisma.clientProjectAccess.findMany({
    where: { userId: user.id },
    select: {
      project: { select: { id: true, name: true } },
    },
  });

  // Get all messages (sent and received) for the client
  const messages = await prisma.directMessage.findMany({
    where: {
      OR: [{ senderId: user.id }, { receiverId: user.id }],
    },
    orderBy: { createdAt: "desc" },
    include: {
      sender: { select: { id: true, name: true, image: true } },
      receiver: { select: { id: true, name: true, image: true } },
      project: { select: { id: true, name: true } },
    },
  });

  // Group messages by the other person + project to form "threads"
  const threadMap = new Map<
    string,
    {
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
  >();

  for (const msg of messages) {
    const isFromClient = msg.senderId === user.id;
    const otherUser = isFromClient ? msg.receiver : msg.sender;
    const threadKey = `${otherUser.id}-${msg.projectId || "general"}`;

    if (!threadMap.has(threadKey)) {
      threadMap.set(threadKey, {
        threadKey,
        otherUserId: otherUser.id,
        otherUserName: otherUser.name || "Unknown",
        otherUserImage: otherUser.image,
        projectId: msg.projectId,
        projectName: msg.project?.name || null,
        lastMessage: msg.content,
        lastMessageAt: msg.createdAt.toISOString(),
        unreadCount: 0,
      });
    }

    const thread = threadMap.get(threadKey)!;
    if (!isFromClient && !msg.read) {
      thread.unreadCount++;
    }
  }

  const threads = Array.from(threadMap.values());

  const projects = accesses.map((a) => ({
    id: a.project.id,
    name: a.project.name,
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-bold text-white"
          style={{ fontFamily: "Playfair Display, serif" }}
        >
          Messages
        </h1>
        <p className="mt-1 text-sm text-white/50">
          Communicate with your project team.
        </p>
      </div>

      <MessageList
        threads={threads}
        projects={projects}
        currentUserId={user.id}
      />
    </div>
  );
}
