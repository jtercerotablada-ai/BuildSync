"use client";

import { useEffect, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  Users,
  FolderKanban,
  MessageSquare,
  BookOpen,
  Plus,
  MoreHorizontal,
  Search,
  Mail,
  Crown,
  Shield,
  User,
  Eye,
  Send,
  Trash2,
  FileText,
  StickyNote,
  LayoutGrid,
} from "lucide-react";

// Types
interface Member {
  id: string;
  role: string;
  joinedAt: string;
  user: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
    jobTitle?: string | null;
  };
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
}

interface Project {
  id: string;
  name: string;
  color: string;
  status: string;
  _count?: { tasks: number };
}

interface Message {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface KnowledgeEntry {
  id: string;
  term: string;
  definition: string;
  category: string | null;
  viewCount: number;
  createdAt: string;
}

interface Note {
  id: string;
  title: string;
  content: string;
  isPinned: boolean;
  visibility: string;
  updatedAt: string;
  author: {
    id: string;
    name: string | null;
    image: string | null;
  };
}

export default function TeamPage() {
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeEntry[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  async function fetchData() {
    setLoading(true);
    try {
      if (activeTab === "overview" || activeTab === "members") {
        const [membersRes, invitationsRes] = await Promise.all([
          fetch("/api/workspace/members"),
          fetch("/api/workspace/invitations"),
        ]);
        if (membersRes.ok) setMembers(await membersRes.json());
        if (invitationsRes.ok) setInvitations(await invitationsRes.json());
      }
      if (activeTab === "overview" || activeTab === "work") {
        const projectsRes = await fetch("/api/projects");
        if (projectsRes.ok) setProjects(await projectsRes.json());
      }
      if (activeTab === "overview" || activeTab === "messages") {
        const messagesRes = await fetch("/api/workspace/messages");
        if (messagesRes.ok) {
          const data = await messagesRes.json();
          setMessages(data.messages || []);
        }
      }
      if (activeTab === "overview" || activeTab === "knowledge") {
        const knowledgeRes = await fetch("/api/workspace/knowledge");
        if (knowledgeRes.ok) {
          const data = await knowledgeRes.json();
          setKnowledge(data.entries || []);
        }
      }
      if (activeTab === "notes") {
        const notesRes = await fetch("/api/workspace/notes");
        if (notesRes.ok) setNotes(await notesRes.json());
      }
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  }

  if (loading && activeTab === "overview") {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-slate-900">My Workspace</h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your team, projects, and knowledge base
        </p>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="overview" className="gap-2">
            <LayoutGrid className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="members" className="gap-2">
            <Users className="h-4 w-4" />
            Members
          </TabsTrigger>
          <TabsTrigger value="work" className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Projects
          </TabsTrigger>
          <TabsTrigger value="messages" className="gap-2">
            <MessageSquare className="h-4 w-4" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="knowledge" className="gap-2">
            <BookOpen className="h-4 w-4" />
            Knowledge
          </TabsTrigger>
          <TabsTrigger value="notes" className="gap-2">
            <StickyNote className="h-4 w-4" />
            Notes
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview">
          <OverviewTab
            members={members}
            projects={projects}
            messages={messages}
            knowledge={knowledge}
            onNavigate={setActiveTab}
          />
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <MembersTab
            members={members}
            invitations={invitations}
            onRefresh={fetchData}
          />
        </TabsContent>

        {/* Work Tab */}
        <TabsContent value="work">
          <WorkTab projects={projects} />
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages">
          <MessagesTab messages={messages} onRefresh={fetchData} />
        </TabsContent>

        {/* Knowledge Tab */}
        <TabsContent value="knowledge">
          <KnowledgeTab entries={knowledge} onRefresh={fetchData} />
        </TabsContent>

        {/* Notes Tab */}
        <TabsContent value="notes">
          <NotesTab notes={notes} onRefresh={fetchData} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Overview Tab Component
function OverviewTab({
  members,
  projects,
  messages,
  knowledge,
  onNavigate,
}: {
  members: Member[];
  projects: Project[];
  messages: Message[];
  knowledge: KnowledgeEntry[];
  onNavigate: (tab: string) => void;
}) {
  const stats = {
    members: members.length,
    projects: projects.length,
    messages: messages.length,
    knowledge: knowledge.length,
  };

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4 cursor-pointer hover:bg-slate-50" onClick={() => onNavigate("members")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{stats.members}</p>
              <p className="text-sm text-slate-500">Team Members</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-slate-50" onClick={() => onNavigate("work")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{stats.projects}</p>
              <p className="text-sm text-slate-500">Projects</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-slate-50" onClick={() => onNavigate("messages")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{stats.messages}</p>
              <p className="text-sm text-slate-500">Messages</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 cursor-pointer hover:bg-slate-50" onClick={() => onNavigate("knowledge")}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-semibold text-slate-900">{stats.knowledge}</p>
              <p className="text-sm text-slate-500">Knowledge Entries</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Activity Grid */}
      <div className="grid grid-cols-2 gap-6">
        {/* Team Members */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-900">Team Members</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("members")}>
              View all
            </Button>
          </div>
          <div className="space-y-3">
            {members.slice(0, 5).map((member) => (
              <div key={member.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="bg-slate-900 text-white text-xs">
                    {member.user.name?.[0] || member.user.email?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {member.user.name || member.user.email}
                  </p>
                  <p className="text-xs text-slate-500">{member.role}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Recent Messages */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-slate-900">Recent Messages</h3>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("messages")}>
              View all
            </Button>
          </div>
          <div className="space-y-3">
            {messages.slice(0, 5).map((message) => (
              <div key={message.id} className="flex items-start gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={message.author.image || undefined} />
                  <AvatarFallback className="bg-slate-900 text-white text-xs">
                    {message.author.name?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">
                    {message.author.name}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{message.content}</p>
                </div>
              </div>
            ))}
            {messages.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">No messages yet</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// Members Tab Component
function MembersTab({
  members,
  invitations,
  onRefresh,
}: {
  members: Member[];
  invitations: Invitation[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("MEMBER");
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviting, setInviting] = useState(false);

  const filteredMembers = members.filter(
    (m) =>
      m.user.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.user.email?.toLowerCase().includes(search.toLowerCase())
  );

  const roleIcons: Record<string, React.ReactNode> = {
    OWNER: <Crown className="h-4 w-4 text-amber-500" />,
    ADMIN: <Shield className="h-4 w-4 text-blue-500" />,
    MEMBER: <User className="h-4 w-4 text-slate-400" />,
    GUEST: <Eye className="h-4 w-4 text-slate-300" />,
  };

  async function handleInvite() {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await fetch("/api/workspace/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      if (res.ok) {
        setInviteEmail("");
        setInviteDialogOpen(false);
        onRefresh();
      }
    } catch (error) {
      console.error("Error inviting member:", error);
    } finally {
      setInviting(false);
    }
  }

  async function handleCancelInvitation(id: string) {
    try {
      await fetch(`/api/workspace/invitations?id=${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Error canceling invitation:", error);
    }
  }

  async function handleRemoveMember(id: string) {
    if (!confirm("Are you sure you want to remove this member?")) return;
    try {
      await fetch(`/api/workspace/members?memberId=${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Error removing member:", error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search members..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              Invite Member
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Invite Team Member</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Email</label>
                <Input
                  type="email"
                  placeholder="colleague@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Role</label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                    <SelectItem value="GUEST">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800"
                onClick={handleInvite}
                disabled={inviting}
              >
                {inviting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send Invitation"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Members List */}
      <Card>
        <div className="divide-y">
          {filteredMembers.map((member) => (
            <div key={member.id} className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={member.user.image || undefined} />
                  <AvatarFallback className="bg-slate-900 text-white">
                    {member.user.name?.[0] || member.user.email?.[0] || "?"}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium text-slate-900">
                    {member.user.name || member.user.email}
                  </p>
                  <p className="text-sm text-slate-500">{member.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  {roleIcons[member.role]}
                  <span className="text-sm text-slate-600">{member.role}</span>
                </div>
                {member.role !== "OWNER" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600"
                        onClick={() => handleRemoveMember(member.id)}
                      >
                        Remove from workspace
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-700 mb-3">Pending Invitations</h3>
          <Card>
            <div className="divide-y">
              {invitations.map((invitation) => (
                <div key={invitation.id} className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <Mail className="h-5 w-5 text-slate-400" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900">{invitation.email}</p>
                      <p className="text-sm text-slate-500">
                        Invited as {invitation.role} - Pending
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCancelInvitation(invitation.id)}
                  >
                    Cancel
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// Work Tab Component
function WorkTab({ projects }: { projects: Project[] }) {
  const [search, setSearch] = useState("");

  const filteredProjects = projects.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusColors: Record<string, string> = {
    ON_TRACK: "bg-green-100 text-green-700",
    AT_RISK: "bg-amber-100 text-amber-700",
    OFF_TRACK: "bg-red-100 text-red-700",
    ON_HOLD: "bg-slate-100 text-slate-700",
    COMPLETE: "bg-blue-100 text-blue-700",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Projects Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredProjects.map((project) => (
          <Card
            key={project.id}
            className="p-4 cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => window.location.href = `/projects/${project.id}`}
          >
            <div className="flex items-start gap-3">
              <div
                className="w-10 h-10 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: project.color + "20" }}
              >
                <FolderKanban className="h-5 w-5" style={{ color: project.color }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{project.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${statusColors[project.status] || "bg-slate-100 text-slate-700"}`}
                  >
                    {project.status.replace("_", " ")}
                  </span>
                  {project._count && (
                    <span className="text-xs text-slate-500">
                      {project._count.tasks} tasks
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredProjects.length === 0 && (
        <div className="text-center py-12">
          <FolderKanban className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No projects found</p>
        </div>
      )}
    </div>
  );
}

// Messages Tab Component
function MessagesTab({
  messages,
  onRefresh,
}: {
  messages: Message[];
  onRefresh: () => void;
}) {
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSendMessage() {
    if (!newMessage.trim()) return;
    setSending(true);
    try {
      const res = await fetch("/api/workspace/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newMessage }),
      });
      if (res.ok) {
        setNewMessage("");
        onRefresh();
      }
    } catch (error) {
      console.error("Error sending message:", error);
    } finally {
      setSending(false);
    }
  }

  async function handleDeleteMessage(id: string) {
    try {
      await fetch(`/api/workspace/messages?id=${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Error deleting message:", error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Message Input */}
      <Card className="p-4">
        <div className="flex gap-3">
          <Input
            placeholder="Write a message to your team..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
            className="flex-1"
          />
          <Button
            className="bg-slate-900 hover:bg-slate-800"
            onClick={handleSendMessage}
            disabled={sending}
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>

      {/* Messages List */}
      <div className="space-y-4">
        {messages.map((message) => (
          <Card key={message.id} className="p-4">
            <div className="flex items-start gap-3">
              <Avatar className="h-10 w-10">
                <AvatarImage src={message.author.image || undefined} />
                <AvatarFallback className="bg-slate-900 text-white">
                  {message.author.name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{message.author.name}</span>
                    <span className="text-xs text-slate-400">
                      {new Date(message.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteMessage(message.id)}
                  >
                    <Trash2 className="h-4 w-4 text-slate-400" />
                  </Button>
                </div>
                <p className="text-slate-700 mt-1">{message.content}</p>
              </div>
            </div>
          </Card>
        ))}

        {messages.length === 0 && (
          <div className="text-center py-12">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No messages yet. Start the conversation!</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Knowledge Tab Component
function KnowledgeTab({
  entries,
  onRefresh,
}: {
  entries: KnowledgeEntry[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTerm, setNewTerm] = useState("");
  const [newDefinition, setNewDefinition] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredEntries = entries.filter(
    (e) =>
      e.term.toLowerCase().includes(search.toLowerCase()) ||
      e.definition.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newTerm.trim() || !newDefinition.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/knowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          term: newTerm,
          definition: newDefinition,
          category: newCategory || null,
        }),
      });
      if (res.ok) {
        setNewTerm("");
        setNewDefinition("");
        setNewCategory("");
        setDialogOpen(false);
        onRefresh();
      }
    } catch (error) {
      console.error("Error creating entry:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    try {
      await fetch(`/api/workspace/knowledge?id=${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Error deleting entry:", error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search knowledge base..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Knowledge Entry</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Term</label>
                <Input
                  placeholder="e.g., Sprint"
                  value={newTerm}
                  onChange={(e) => setNewTerm(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Definition</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={4}
                  placeholder="Explain the term..."
                  value={newDefinition}
                  onChange={(e) => setNewDefinition(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Category (optional)</label>
                <Input
                  placeholder="e.g., Agile, Development"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                />
              </div>
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Entry"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Entries Grid */}
      <div className="grid grid-cols-2 gap-4">
        {filteredEntries.map((entry) => (
          <Card key={entry.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-medium text-slate-900">{entry.term}</h3>
                  {entry.category && (
                    <span className="text-xs px-2 py-0.5 bg-slate-100 rounded-full text-slate-600">
                      {entry.category}
                    </span>
                  )}
                </div>
                <p className="text-sm text-slate-600 line-clamp-3">{entry.definition}</p>
                <p className="text-xs text-slate-400 mt-2">{entry.viewCount} views</p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(entry.id)}>
                <Trash2 className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredEntries.length === 0 && (
        <div className="text-center py-12">
          <BookOpen className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No knowledge entries found</p>
        </div>
      )}
    </div>
  );
}

// Notes Tab Component
function NotesTab({
  notes,
  onRefresh,
}: {
  notes: Note[];
  onRefresh: () => void;
}) {
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredNotes = notes.filter(
    (n) =>
      n.title.toLowerCase().includes(search.toLowerCase()) ||
      n.content.toLowerCase().includes(search.toLowerCase())
  );

  async function handleCreate() {
    if (!newTitle.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/workspace/notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          content: newContent,
        }),
      });
      if (res.ok) {
        setNewTitle("");
        setNewContent("");
        setDialogOpen(false);
        onRefresh();
      }
    } catch (error) {
      console.error("Error creating note:", error);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this note?")) return;
    try {
      await fetch(`/api/workspace/notes?id=${id}`, { method: "DELETE" });
      onRefresh();
    } catch (error) {
      console.error("Error deleting note:", error);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 bg-slate-900 hover:bg-slate-800">
              <Plus className="h-4 w-4" />
              New Note
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Note</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div>
                <label className="text-sm font-medium text-slate-700">Title</label>
                <Input
                  placeholder="Note title"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium text-slate-700">Content</label>
                <textarea
                  className="w-full px-3 py-2 border rounded-md text-sm"
                  rows={6}
                  placeholder="Write your note..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                />
              </div>
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800"
                onClick={handleCreate}
                disabled={saving}
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Note"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Notes Grid */}
      <div className="grid grid-cols-3 gap-4">
        {filteredNotes.map((note) => (
          <Card key={note.id} className="p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between mb-2">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-400" />
                <h3 className="font-medium text-slate-900 truncate">{note.title}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(note.id)}>
                <Trash2 className="h-4 w-4 text-slate-400" />
              </Button>
            </div>
            <p className="text-sm text-slate-600 line-clamp-4">{note.content}</p>
            <div className="flex items-center gap-2 mt-3 pt-3 border-t">
              <Avatar className="h-5 w-5">
                <AvatarImage src={note.author.image || undefined} />
                <AvatarFallback className="bg-slate-900 text-white text-[10px]">
                  {note.author.name?.[0] || "?"}
                </AvatarFallback>
              </Avatar>
              <span className="text-xs text-slate-500">
                {new Date(note.updatedAt).toLocaleDateString()}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {filteredNotes.length === 0 && (
        <div className="text-center py-12">
          <StickyNote className="h-12 w-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-500">No notes found</p>
        </div>
      )}
    </div>
  );
}
