"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Plus,
  Folder,
  Loader2,
  Search,
  AlertTriangle,
  TrendingUp,
  Wallet,
  Star,
  List as ListIcon,
  CalendarRange,
  LayoutDashboard,
  Activity,
  Users,
  MessageSquare,
  CheckCircle,
  ArrowRight,
  ArrowLeft,
  Lock,
  Globe,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { SectionGuard } from "@/components/access/section-guard";
import { cn } from "@/lib/utils";

type PortfolioStatus =
  | "ON_TRACK"
  | "AT_RISK"
  | "OFF_TRACK"
  | "ON_HOLD"
  | "COMPLETE";

interface PortfolioStats {
  totalBudget: number;
  currency: string;
  totalTasks: number;
  completedTasks: number;
  overdueTasks: number;
  avgProgress: number;
  health: {
    onTrack: number;
    atRisk: number;
    offTrack: number;
    onHold: number;
    complete: number;
  };
}

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
  status: PortfolioStatus;
  updatedAt: string;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  _count: {
    projects: number;
  };
  stats: PortfolioStats;
}

const STATUS_META: Record<
  PortfolioStatus,
  { label: string; dot: string; chip: string }
> = {
  ON_TRACK: {
    label: "On track",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a] border-[#c9a84c]/30",
  },
  AT_RISK: {
    label: "At risk",
    dot: "bg-[#a8893a]",
    chip: "bg-[#a8893a]/15 text-[#a8893a] border-[#a8893a]/40",
  },
  OFF_TRACK: {
    label: "Off track",
    dot: "bg-black",
    chip: "bg-gray-900/10 text-black border-gray-900/30",
  },
  ON_HOLD: {
    label: "On hold",
    dot: "bg-gray-400",
    chip: "bg-gray-100 text-gray-700 border-gray-300",
  },
  COMPLETE: {
    label: "Complete",
    dot: "bg-[#c9a84c]",
    chip: "bg-[#c9a84c]/15 text-[#a8893a] border-[#c9a84c]/30",
  },
};

const FAVORITES_KEY = "buildsync.portfolios.favorites";

function loadFavorites(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) ? new Set(arr.filter((v): v is string => typeof v === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function saveFavorites(ids: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify([...ids]));
  } catch {
    // localStorage may be full or blocked — ignore.
  }
}

function formatBudget(value: number, currency: string): string {
  if (value <= 0) return "—";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString("en-US")}`;
  }
}

export default function PortfoliosPage() {
  return (
    <SectionGuard section="portfolios">
      <PortfoliosPageInner />
    </SectionGuard>
  );
}

type Tab = "recent" | "all";
type StatusFilter = "all" | PortfolioStatus;

type Privacy = "PRIVATE" | "WORKSPACE" | "PUBLIC";
type DefaultView =
  | "list"
  | "timeline"
  | "panel"
  | "progress"
  | "workload"
  | "messages";

function PortfoliosPageInner() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [step, setStep] = useState<"config" | "onboarding">("config");
  const [createdId, setCreatedId] = useState<string | null>(null);
  const [newPortfolio, setNewPortfolio] = useState<{
    name: string;
    description: string;
    privacy: Privacy;
    defaultView: DefaultView;
  }>({
    name: "",
    description: "",
    privacy: "WORKSPACE",
    defaultView: "list",
  });
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [tab, setTab] = useState<Tab>("recent");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  useEffect(() => {
    fetchPortfolios();
    setFavorites(loadFavorites());
  }, []);

  async function fetchPortfolios() {
    try {
      const res = await fetch("/api/portfolios");
      if (res.ok) {
        const data = await res.json();
        setPortfolios(data);
      } else {
        toast.error("Failed to load portfolios");
      }
    } catch (error) {
      console.error("Error fetching portfolios:", error);
      toast.error("Failed to load portfolios");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!newPortfolio.name.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/portfolios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newPortfolio.name,
          description: newPortfolio.description,
          privacy: newPortfolio.privacy,
        }),
      });

      if (res.ok) {
        const portfolio = await res.json();
        setCreatedId(portfolio.id);
        setStep("onboarding");
        toast.success("Portfolio created");
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.error || "Failed to create portfolio");
      }
    } catch (error) {
      console.error("Error creating portfolio:", error);
      toast.error("Failed to create portfolio");
    } finally {
      setCreating(false);
    }
  }

  function resetCreateDialog() {
    setCreateOpen(false);
    setStep("config");
    setCreatedId(null);
    setNewPortfolio({
      name: "",
      description: "",
      privacy: "WORKSPACE",
      defaultView: "list",
    });
  }

  function goToCreated(action: "add" | "share" | "open") {
    if (!createdId) return;
    const url = `/portfolios/${createdId}${
      action === "add"
        ? `?view=${newPortfolio.defaultView}&action=add`
        : action === "share"
          ? `?view=${newPortfolio.defaultView}&action=share`
          : `?view=${newPortfolio.defaultView}`
    }`;
    resetCreateDialog();
    router.push(url);
  }

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      saveFavorites(next);
      return next;
    });
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = portfolios;

    if (tab === "recent") {
      const favIds = favorites;
      const favList = portfolios.filter((p) => favIds.has(p.id));
      const recent = portfolios
        .filter((p) => !favIds.has(p.id))
        .slice(0, Math.max(6 - favList.length, 0));
      list = [...favList, ...recent];
    }

    if (statusFilter !== "all") {
      list = list.filter((p) => p.status === statusFilter);
    }

    if (q) {
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [portfolios, tab, statusFilter, search, favorites]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background w-full">
      {/* ── Full-bleed header (matches Goals / My-Tasks pattern) ─ */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b">
        <div className="min-w-0">
          <h1 className="text-lg md:text-xl font-semibold text-black">
            Portfolios
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-0.5">
            Group projects, watch health, and forecast budget across the firm.
          </p>
        </div>
        <Dialog
          open={createOpen}
          onOpenChange={(o) => {
            if (!o) resetCreateDialog();
            else setCreateOpen(true);
          }}
        >
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-gray-800 w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create portfolio
            </Button>
          </DialogTrigger>
          <DialogContent
            className="max-w-none w-screen h-screen rounded-none border-0 p-0 gap-0 translate-x-0 translate-y-0 left-0 top-0 sm:max-w-none"
            showCloseButton={false}
          >
            {step === "config" ? (
              <CreateStepConfig
                value={newPortfolio}
                onChange={setNewPortfolio}
                onSubmit={handleCreate}
                creating={creating}
                onClose={resetCreateDialog}
              />
            ) : (
              <CreateStepOnboarding
                portfolioName={newPortfolio.name}
                onAction={goToCreated}
                onClose={resetCreateDialog}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-4 md:px-6 py-4 md:py-6">

      {/* ── Tabs ──────────────────────────────────────────────── */}
      {portfolios.length > 0 && (
        <div className="flex items-center gap-1 border-b border-gray-200 mb-4">
          <TabButton active={tab === "recent"} onClick={() => setTab("recent")}>
            Recent & favorites
          </TabButton>
          <TabButton active={tab === "all"} onClick={() => setTab("all")}>
            Browse all
          </TabButton>
        </div>
      )}

      {/* ── Toolbar (only in 'all' tab) ───────────────────────── */}
      {portfolios.length > 0 && tab === "all" && (
        <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
          <div className="relative flex-1 md:max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <Input
              placeholder="Search portfolios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <FilterChip
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            >
              All
            </FilterChip>
            <FilterChip
              active={statusFilter === "ON_TRACK"}
              onClick={() => setStatusFilter("ON_TRACK")}
            >
              <span className="w-2 h-2 rounded-full bg-[#c9a84c] mr-1.5 inline-block" />
              On track
            </FilterChip>
            <FilterChip
              active={statusFilter === "AT_RISK"}
              onClick={() => setStatusFilter("AT_RISK")}
            >
              <span className="w-2 h-2 rounded-full bg-[#a8893a] mr-1.5 inline-block" />
              At risk
            </FilterChip>
            <FilterChip
              active={statusFilter === "OFF_TRACK"}
              onClick={() => setStatusFilter("OFF_TRACK")}
            >
              <span className="w-2 h-2 rounded-full bg-black mr-1.5 inline-block" />
              Off track
            </FilterChip>
            <FilterChip
              active={statusFilter === "ON_HOLD"}
              onClick={() => setStatusFilter("ON_HOLD")}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400 mr-1.5 inline-block" />
              On hold
            </FilterChip>
          </div>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────── */}
      {portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Folder className="h-8 w-8 text-[#a8893a]" />
          </div>
          <h2 className="text-lg font-medium text-black mb-2">
            No portfolios yet
          </h2>
          <p className="text-sm text-gray-600 max-w-md mb-4">
            Create a portfolio to group related projects, monitor health across
            the firm, and forecast budget.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-black hover:bg-gray-800"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create your first portfolio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3 md:gap-4">
          <Card
            className="p-4 md:p-5 pt-3 border-2 border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50 cursor-pointer transition-colors flex flex-col items-center text-center justify-center min-h-[240px] group"
            onClick={() => setCreateOpen(true)}
          >
            <div className="w-16 h-16 rounded-full bg-gray-100 group-hover:bg-gray-200 flex items-center justify-center mb-3 transition-colors">
              <Plus className="h-6 w-6 text-gray-500" />
            </div>
            <span className="text-sm font-semibold text-black">
              Create portfolio
            </span>
            <span className="text-xs text-gray-500 mt-0.5">
              Group projects together
            </span>
          </Card>

          {filtered.map((portfolio) => (
            <PortfolioCard
              key={portfolio.id}
              portfolio={portfolio}
              isFavorite={favorites.has(portfolio.id)}
              onToggleFavorite={(e) => {
                e.stopPropagation();
                toggleFavorite(portfolio.id);
              }}
              onClick={() => router.push(`/portfolios/${portfolio.id}`)}
            />
          ))}

          {filtered.length === 0 && tab === "all" && (
            <div className="col-span-full text-center py-12 text-sm text-gray-500">
              No portfolios match your filters.
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

// ── Components ───────────────────────────────────────────────

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-3 py-2 text-sm font-medium border-b-2 transition-colors",
        active
          ? "border-black text-black"
          : "border-transparent text-gray-500 hover:text-black"
      )}
    >
      {children}
    </button>
  );
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        active
          ? "bg-black text-white border-black"
          : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
      )}
    >
      {children}
    </button>
  );
}

function CreateStepConfig({
  value,
  onChange,
  onSubmit,
  creating,
  onClose,
}: {
  value: {
    name: string;
    description: string;
    privacy: Privacy;
    defaultView: DefaultView;
  };
  onChange: (
    v: {
      name: string;
      description: string;
      privacy: Privacy;
      defaultView: DefaultView;
    }
  ) => void;
  onSubmit: () => void;
  creating: boolean;
  onClose: () => void;
}) {
  const views: {
    id: DefaultView;
    label: string;
    description: string;
    icon: React.ReactNode;
    illustration: React.ReactNode;
  }[] = [
    {
      id: "list",
      label: "List",
      description: "Stack of projects.",
      icon: <ListIcon className="h-5 w-5" />,
      illustration: <ListIllustration />,
    },
    {
      id: "timeline",
      label: "Timeline",
      description: "Gantt by date.",
      icon: <CalendarRange className="h-5 w-5" />,
      illustration: <TimelineIllustration />,
    },
    {
      id: "panel",
      label: "Panel",
      description: "Widgets & charts.",
      icon: <LayoutDashboard className="h-5 w-5" />,
      illustration: <PanelIllustration />,
    },
    {
      id: "progress",
      label: "Progress",
      description: "Updates feed.",
      icon: <Activity className="h-5 w-5" />,
      illustration: <ProgressIllustration />,
    },
    {
      id: "workload",
      label: "Workload",
      description: "Member matrix.",
      icon: <Users className="h-5 w-5" />,
      illustration: <WorkloadIllustration />,
    },
    {
      id: "messages",
      label: "Messages",
      description: "Team channel.",
      icon: <MessageSquare className="h-5 w-5" />,
      illustration: <MessagesIllustration />,
    },
  ];

  const privacyOptions: {
    value: Privacy;
    label: string;
    description: string;
    icon: React.ReactNode;
  }[] = [
    {
      value: "PRIVATE",
      label: "Private to me",
      description: "Only you and members you add.",
      icon: <Lock className="h-4 w-4" />,
    },
    {
      value: "WORKSPACE",
      label: "Workspace members",
      description: "Anyone in your workspace.",
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: "PUBLIC",
      label: "Public",
      description: "Anyone with the link.",
      icon: <Globe className="h-4 w-4" />,
    },
  ];

  return (
    <div className="flex flex-col h-screen w-screen bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 md:px-6 py-3 border-b flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-md"
          aria-label="Back"
        >
          <ArrowLeft className="h-5 w-5 text-gray-700" />
        </button>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-md"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      {/* Main grid */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-[minmax(0,520px)_minmax(0,1fr)] overflow-hidden">
        {/* Form column */}
        <div className="px-6 md:px-10 py-6 md:py-8 overflow-y-auto">
          <h1 className="text-2xl md:text-3xl font-semibold text-black mb-6 md:mb-8">
            New portfolio
          </h1>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-black">
                Portfolio name
              </Label>
              <Input
                id="name"
                placeholder="e.g., Q1 Initiatives"
                value={value.name}
                onChange={(e) => onChange({ ...value, name: e.target.value })}
                autoFocus
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label
                htmlFor="description"
                className="text-sm font-medium text-black"
              >
                Description{" "}
                <span className="text-gray-400 font-normal">(optional)</span>
              </Label>
              <Textarea
                id="description"
                placeholder="What is this portfolio for?"
                value={value.description}
                onChange={(e) =>
                  onChange({ ...value, description: e.target.value })
                }
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-black">Privacy</Label>
              <div className="space-y-2">
                {privacyOptions.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => onChange({ ...value, privacy: opt.value })}
                    className={cn(
                      "w-full text-left px-3.5 py-3 rounded-lg border-2 flex items-center gap-3 transition-colors",
                      value.privacy === opt.value
                        ? "border-black bg-gray-50"
                        : "border-gray-200 hover:border-gray-400"
                    )}
                  >
                    <span
                      className={cn(
                        "flex-shrink-0",
                        value.privacy === opt.value
                          ? "text-black"
                          : "text-gray-500"
                      )}
                    >
                      {opt.icon}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-black">
                        {opt.label}
                      </span>
                      <span className="block text-xs text-gray-500 mt-0.5">
                        {opt.description}
                      </span>
                    </span>
                    {value.privacy === opt.value && (
                      <CheckCircle className="h-5 w-5 text-black flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium text-black">
                Default view
              </Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {views.map((v) => {
                  const active = value.defaultView === v.id;
                  return (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() =>
                        onChange({ ...value, defaultView: v.id })
                      }
                      className={cn(
                        "flex flex-col items-start gap-1 p-3 rounded-lg border-2 transition-colors text-left",
                        active
                          ? "border-black bg-gray-50"
                          : "border-gray-200 hover:border-gray-400"
                      )}
                    >
                      <div className="w-full aspect-[5/3] bg-white rounded-md border border-gray-200 flex items-center justify-center overflow-hidden mb-1">
                        {v.illustration}
                      </div>
                      <div
                        className={cn(
                          "flex items-center gap-1.5",
                          active ? "text-black" : "text-gray-700"
                        )}
                      >
                        {v.icon}
                        <span className="text-sm font-medium">{v.label}</span>
                      </div>
                      <span className="text-[11px] text-gray-500 leading-tight">
                        {v.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Preview column */}
        <div className="hidden md:flex bg-gray-50 p-8 lg:p-12 items-center justify-center overflow-hidden">
          <PreviewMock
            name={value.name}
            defaultView={value.defaultView}
            views={views.map((v) => ({ id: v.id, label: v.label }))}
          />
        </div>
      </div>

      {/* Bottom bar */}
      <div className="px-4 md:px-10 py-3 md:py-4 border-t flex justify-end flex-shrink-0">
        <Button
          className="bg-black hover:bg-gray-800 h-11 px-6"
          onClick={onSubmit}
          disabled={creating || !value.name.trim()}
        >
          {creating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating...
            </>
          ) : (
            <>
              Continue
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Default-view illustrations (mini visual cues) ──────────────

function ListIllustration() {
  return (
    <svg viewBox="0 0 80 48" className="w-full h-full">
      {[8, 20, 32].map((y) => (
        <g key={y}>
          <circle cx="10" cy={y + 4} r="2" fill="#c9a84c" />
          <rect x="16" y={y} width="38" height="8" rx="2" fill="#e5e7eb" />
          <rect x="58" y={y + 2} width="14" height="4" rx="1" fill="#f3f4f6" />
        </g>
      ))}
    </svg>
  );
}

function TimelineIllustration() {
  return (
    <svg viewBox="0 0 80 48" className="w-full h-full">
      <line x1="0" y1="14" x2="80" y2="14" stroke="#e5e7eb" />
      <line x1="0" y1="26" x2="80" y2="26" stroke="#e5e7eb" />
      <line x1="0" y1="38" x2="80" y2="38" stroke="#e5e7eb" />
      <rect x="6" y="11" width="28" height="6" rx="1.5" fill="#c9a84c" />
      <rect x="22" y="23" width="34" height="6" rx="1.5" fill="#a8893a" />
      <rect x="40" y="35" width="32" height="6" rx="1.5" fill="#000000" />
    </svg>
  );
}

function PanelIllustration() {
  return (
    <svg viewBox="0 0 80 48" className="w-full h-full">
      <rect x="4" y="6" width="22" height="14" rx="2" fill="#f3f4f6" />
      <rect x="30" y="6" width="22" height="14" rx="2" fill="#f3f4f6" />
      <rect x="56" y="6" width="20" height="14" rx="2" fill="#f3f4f6" />
      <circle cx="16" cy="34" r="9" fill="none" stroke="#c9a84c" strokeWidth="3" />
      <rect x="34" y="28" width="6" height="12" fill="#a8893a" />
      <rect x="44" y="22" width="6" height="18" fill="#c9a84c" />
      <rect x="54" y="32" width="6" height="8" fill="#a8893a" />
      <rect x="64" y="26" width="6" height="14" fill="#c9a84c" />
    </svg>
  );
}

function ProgressIllustration() {
  return (
    <svg viewBox="0 0 80 48" className="w-full h-full">
      <circle cx="14" cy="14" r="6" fill="#c9a84c" />
      <rect x="24" y="11" width="40" height="3" rx="1" fill="#e5e7eb" />
      <rect x="24" y="16" width="28" height="2" rx="1" fill="#f3f4f6" />
      <circle cx="14" cy="36" r="6" fill="#a8893a" />
      <rect x="24" y="33" width="38" height="3" rx="1" fill="#e5e7eb" />
      <rect x="24" y="38" width="22" height="2" rx="1" fill="#f3f4f6" />
    </svg>
  );
}

function WorkloadIllustration() {
  return (
    <svg viewBox="0 0 80 48" className="w-full h-full">
      {[0, 1, 2].map((row) =>
        [0, 1, 2, 3, 4].map((col) => {
          const opacities = [0.2, 0.5, 0.8, 0.4, 0.6, 0.3, 0.9, 0.2, 0.5, 0.7, 0.4, 0.3, 0.5, 0.8, 0.2];
          return (
            <rect
              key={`${row}-${col}`}
              x={14 + col * 13}
              y={6 + row * 13}
              width="11"
              height="11"
              rx="1.5"
              fill={`rgba(201,168,76,${opacities[row * 5 + col]})`}
            />
          );
        })
      )}
      <circle cx="6" cy="11" r="3" fill="#a8893a" />
      <circle cx="6" cy="24" r="3" fill="#a8893a" />
      <circle cx="6" cy="37" r="3" fill="#a8893a" />
    </svg>
  );
}

function MessagesIllustration() {
  return (
    <svg viewBox="0 0 80 48" className="w-full h-full">
      <circle cx="12" cy="14" r="4" fill="#a8893a" />
      <rect x="20" y="10" width="42" height="3" rx="1.5" fill="#e5e7eb" />
      <rect x="20" y="15" width="30" height="3" rx="1.5" fill="#f3f4f6" />
      <circle cx="12" cy="34" r="4" fill="#c9a84c" />
      <rect x="20" y="30" width="36" height="3" rx="1.5" fill="#e5e7eb" />
      <rect x="20" y="35" width="44" height="3" rx="1.5" fill="#f3f4f6" />
    </svg>
  );
}

// ── Preview mock (renders the currently picked view) ───────────

function PreviewMock({
  name,
  defaultView,
  views,
}: {
  name: string;
  defaultView: DefaultView;
  views: { id: DefaultView; label: string }[];
}) {
  return (
    <div className="w-full max-w-[640px] bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-[#a8893a]/15 flex items-center justify-center">
          <Folder className="h-4 w-4 text-[#a8893a]" />
        </div>
        <span className="text-sm font-medium text-black truncate flex-1">
          {name || "Your portfolio"}
        </span>
        <span className="px-2 py-0.5 rounded-full bg-[#c9a84c]/15 text-[10px] text-[#a8893a] font-medium">
          On track
        </span>
      </div>
      <div className="px-4 border-b flex gap-4 text-xs overflow-x-auto">
        {views.map((v) => (
          <span
            key={v.id}
            className={cn(
              "py-2 whitespace-nowrap",
              defaultView === v.id
                ? "text-black font-medium border-b-2 border-black"
                : "text-gray-500"
            )}
          >
            {v.label}
          </span>
        ))}
      </div>
      <div className="p-4">
        {defaultView === "list" && <MockList />}
        {defaultView === "timeline" && <MockTimeline />}
        {defaultView === "panel" && <MockPanel />}
        {defaultView === "progress" && <MockProgress />}
        {defaultView === "workload" && <MockWorkload />}
        {defaultView === "messages" && <MockMessages />}
      </div>
    </div>
  );
}

function MockList() {
  const rows = [
    { color: "#3b82f6", name: "Brickell Mixed-Use", progress: 65, status: "On track" },
    { color: "#ec4899", name: "Polanco Residential Tower", progress: 42, status: "At risk" },
    { color: "#10b981", name: "NYC FISP Cycle 9 — 521 W57", progress: 88, status: "On track" },
    { color: "#a855f7", name: "Wynwood Warehouse", progress: 23, status: "On track" },
    { color: "#f59e0b", name: "Coral Gables Permit — 4040", progress: 71, status: "At risk" },
  ];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-3 px-2 pb-1 text-[10px] uppercase tracking-wider text-gray-400 font-medium">
        <div className="col-span-6">Name</div>
        <div className="col-span-3">Status</div>
        <div className="col-span-3">Progress</div>
      </div>
      {rows.map((r) => (
        <div
          key={r.name}
          className="grid grid-cols-12 gap-3 px-2 py-1.5 items-center text-xs"
        >
          <div className="col-span-6 flex items-center gap-2 min-w-0">
            <div
              className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
              style={{ backgroundColor: r.color }}
            />
            <span className="text-black truncate">{r.name}</span>
          </div>
          <div className="col-span-3">
            <span
              className={cn(
                "text-[10px] px-1.5 py-0.5 rounded-full",
                r.status === "At risk"
                  ? "bg-amber-100 text-amber-800"
                  : "bg-[#c9a84c]/15 text-[#a8893a]"
              )}
            >
              {r.status}
            </span>
          </div>
          <div className="col-span-3 flex items-center gap-1.5">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#a8893a]"
                style={{ width: `${r.progress}%` }}
              />
            </div>
            <span className="text-[10px] text-gray-500 tabular-nums w-6">
              {r.progress}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

function MockTimeline() {
  const bars = [
    { color: "#c9a84c", left: 5, width: 35, name: "Brickell Mixed-Use" },
    { color: "#a8893a", left: 25, width: 45, name: "Polanco Tower" },
    { color: "#000000", left: 50, width: 30, name: "NYC FISP" },
    { color: "#c9a84c", left: 10, width: 55, name: "Wynwood" },
    { color: "#a8893a", left: 35, width: 40, name: "Coral Gables" },
  ];
  return (
    <div>
      <div className="flex gap-0 text-[10px] text-gray-500 border-b pb-1 mb-2">
        {["Q1", "Q2", "Q3", "Q4"].map((q) => (
          <span key={q} className="flex-1 text-center">
            {q}
          </span>
        ))}
      </div>
      <div className="space-y-2">
        {bars.map((b, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-28 truncate text-black">{b.name}</span>
            <div className="flex-1 relative h-4 bg-gray-50 rounded">
              <div
                className="absolute top-0.5 bottom-0.5 rounded"
                style={{
                  left: `${b.left}%`,
                  width: `${b.width}%`,
                  backgroundColor: b.color,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "Projects", value: "12" },
          { label: "Budget", value: "$48M" },
          { label: "Progress", value: "62%" },
          { label: "At risk", value: "2" },
        ].map((k) => (
          <div key={k.label} className="border rounded p-2">
            <div className="text-[9px] uppercase text-gray-400">{k.label}</div>
            <div className="text-sm font-semibold tabular-nums">{k.value}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="border rounded p-3 flex items-center justify-center">
          <svg viewBox="0 0 60 60" className="w-20 h-20">
            <circle
              cx="30"
              cy="30"
              r="22"
              fill="none"
              stroke="#e5e7eb"
              strokeWidth="8"
            />
            <circle
              cx="30"
              cy="30"
              r="22"
              fill="none"
              stroke="#c9a84c"
              strokeWidth="8"
              strokeDasharray={`${0.62 * 2 * Math.PI * 22} ${2 * Math.PI * 22}`}
              strokeDashoffset={2 * Math.PI * 22 * 0.25}
              transform="rotate(-90 30 30)"
            />
          </svg>
        </div>
        <div className="border rounded p-3 flex items-end justify-around gap-2">
          {[60, 80, 40, 90, 55].map((h, i) => (
            <div
              key={i}
              className="w-3 rounded-sm bg-[#a8893a]"
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MockProgress() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: "In progress", value: 8 },
          { label: "At risk", value: 2 },
          { label: "Off track", value: 1 },
          { label: "Total", value: 12 },
        ].map((k) => (
          <div key={k.label} className="border rounded p-2 text-center">
            <div className="text-lg font-semibold tabular-nums text-black">
              {k.value}
            </div>
            <div className="text-[9px] text-gray-500">{k.label}</div>
          </div>
        ))}
      </div>
      <div className="space-y-2">
        {[
          { name: "Juan T.", status: "On track", text: "Wrapped permitting." },
          { name: "Maria L.", status: "At risk", text: "Concrete delivery delayed." },
        ].map((u, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <div className="w-6 h-6 rounded-full bg-[#a8893a]/30 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-black text-[11px]">
                  {u.name}
                </span>
                <span
                  className={cn(
                    "text-[9px] px-1 py-0.5 rounded",
                    u.status === "At risk"
                      ? "bg-amber-100 text-amber-800"
                      : "bg-[#c9a84c]/15 text-[#a8893a]"
                  )}
                >
                  {u.status}
                </span>
              </div>
              <p className="text-gray-600 text-[10px] mt-0.5 truncate">
                {u.text}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MockWorkload() {
  return (
    <div>
      <div className="flex gap-0 text-[9px] text-gray-400 pb-1 mb-1.5">
        <div className="w-20" />
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
          <span key={d} className="flex-1 text-center">
            {d}
          </span>
        ))}
      </div>
      {[
        { name: "Juan", loads: [0.4, 0.7, 0.9, 0.5, 0.3, 0, 0] },
        { name: "Maria", loads: [0.2, 0.5, 0.4, 0.8, 0.6, 0.1, 0] },
        { name: "Carlos", loads: [0.6, 0.3, 0.5, 0.2, 0.9, 0, 0] },
      ].map((row) => (
        <div key={row.name} className="flex items-center gap-0 mb-1">
          <div className="w-20 text-xs text-black truncate">{row.name}</div>
          {row.loads.map((l, i) => (
            <div
              key={i}
              className="flex-1 h-5 mx-0.5 rounded-sm"
              style={{
                backgroundColor:
                  l > 0
                    ? `rgba(201,168,76,${0.15 + l * 0.65})`
                    : "#f9fafb",
              }}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

function MockMessages() {
  return (
    <div className="space-y-3">
      {[
        {
          name: "Juan Tercero",
          time: "2h ago",
          text: "Brickell tower foundation pour completed yesterday — moving to columns.",
        },
        {
          name: "Maria López",
          time: "5h ago",
          text: "Polanco re-cert documents uploaded to the portal for review.",
        },
        {
          name: "Carlos Ruiz",
          time: "1d ago",
          text: "Coral Gables permit application sent. Awaiting city response.",
        },
      ].map((m, i) => (
        <div key={i} className="flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-full bg-[#a8893a]/30 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-black">{m.name}</span>
              <span className="text-[10px] text-gray-400">{m.time}</span>
            </div>
            <p className="text-[11px] text-gray-700 mt-0.5">{m.text}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreateStepOnboarding({
  portfolioName,
  onAction,
  onClose,
}: {
  portfolioName: string;
  onAction: (action: "add" | "share" | "open") => void;
  onClose: () => void;
}) {
  return (
    <div className="flex flex-col h-screen w-screen bg-white">
      {/* Top bar */}
      <div className="flex items-center justify-end px-4 md:px-6 py-3 border-b flex-shrink-0">
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-md"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-700" />
        </button>
      </div>

      {/* Centered content */}
      <div className="flex-1 flex items-center justify-center px-6 py-8 overflow-y-auto">
        <div className="w-full max-w-xl space-y-6">
          <div className="text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#c9a84c]/15 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-7 w-7 text-[#a8893a]" />
            </div>
            <h1 className="text-2xl md:text-3xl font-semibold text-black mb-1">
              What do you want to do first?
            </h1>
            <p className="text-sm text-gray-500">
              <strong className="text-black">{portfolioName}</strong> is ready
              to go.
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={() => onAction("add")}
              className="w-full text-left px-5 py-4 rounded-xl border-2 border-black bg-gray-50 hover:bg-gray-100 flex items-start gap-4 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-black flex items-center justify-center flex-shrink-0">
                <Plus className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-black">
                  Start adding projects
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Add projects and track their progress together.
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-black flex-shrink-0 mt-1" />
            </button>

            <button
              onClick={() => onAction("share")}
              className="w-full text-left px-5 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-400 flex items-start gap-4 transition-colors"
            >
              <div className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-5 w-5 text-gray-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-base font-semibold text-black">
                  Share with teammates
                </div>
                <div className="text-sm text-gray-600 mt-0.5">
                  Invite people to view or edit this portfolio.
                </div>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400 flex-shrink-0 mt-1" />
            </button>

            <button
              onClick={() => onAction("open")}
              className="w-full text-left px-5 py-4 rounded-xl border-2 border-gray-200 hover:border-gray-400 flex items-center gap-4 transition-colors"
            >
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <span className="text-sm text-gray-700">
                Just open the portfolio
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortfolioCard({
  portfolio,
  isFavorite,
  onToggleFavorite,
  onClick,
}: {
  portfolio: Portfolio;
  isFavorite: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onClick: () => void;
}) {
  const meta = STATUS_META[portfolio.status];
  const { stats, _count } = portfolio;
  const health = stats.health;
  const totalHealth =
    health.onTrack +
    health.atRisk +
    health.offTrack +
    health.onHold +
    health.complete;
  const riskCount = health.atRisk + health.offTrack;

  const accentColor = portfolio.color || "#a8893a";
  const ownerInitial =
    portfolio.owner?.name?.charAt(0).toUpperCase() || "?";

  return (
    <Card
      className="relative p-4 md:p-5 pt-3 hover:shadow-md cursor-pointer transition-all min-h-[240px] flex flex-col group bg-white border-gray-200"
      onClick={onClick}
    >
      {/* Top row: small color swatch + favorite */}
      <div className="w-full flex items-center justify-between mb-2 h-6">
        <span
          className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
          style={{ backgroundColor: accentColor }}
          aria-hidden="true"
        />
        <button
          onClick={onToggleFavorite}
          className={cn(
            "p-1 rounded hover:bg-gray-100 transition-opacity",
            isFavorite ? "opacity-100" : "opacity-0 group-hover:opacity-100"
          )}
          aria-label={isFavorite ? "Unfavorite" : "Favorite"}
        >
          <Star
            className={cn(
              "h-4 w-4",
              isFavorite
                ? "fill-[#c9a84c] text-[#c9a84c]"
                : "text-gray-400"
            )}
          />
        </button>
      </div>

      {/* Avatar as visual anchor with status dot adjacent */}
      <div className="flex flex-col items-center text-center">
        <div className="relative mb-3">
          <Avatar className="h-16 w-16">
            <AvatarImage src={portfolio.owner?.image || ""} />
            <AvatarFallback
              className="text-lg font-medium text-white"
              style={{ backgroundColor: accentColor }}
            >
              {ownerInitial}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full ring-2 ring-white",
              meta.dot
            )}
            title={meta.label}
          />
        </div>

        {/* Subtle folder icon + name */}
        <div className="flex items-center gap-1.5 min-w-0 w-full justify-center px-2">
          <Folder
            className="h-3.5 w-3.5 text-gray-400 flex-shrink-0"
            strokeWidth={1.5}
          />
          <h3 className="font-semibold text-black text-sm md:text-base truncate">
            {portfolio.name}
          </h3>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          {_count.projects}{" "}
          {_count.projects === 1 ? "project" : "projects"}
        </p>
      </div>

      {/* Health bar */}
      {totalHealth > 0 && (
        <div className="w-full mt-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
            {health.onTrack > 0 && (
              <div
                className="bg-[#c9a84c]"
                style={{ width: `${(health.onTrack / totalHealth) * 100}%` }}
              />
            )}
            {health.complete > 0 && (
              <div
                className="bg-[#a8893a]"
                style={{ width: `${(health.complete / totalHealth) * 100}%` }}
              />
            )}
            {health.atRisk > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${(health.atRisk / totalHealth) * 100}%` }}
              />
            )}
            {health.offTrack > 0 && (
              <div
                className="bg-black"
                style={{ width: `${(health.offTrack / totalHealth) * 100}%` }}
              />
            )}
            {health.onHold > 0 && (
              <div
                className="bg-gray-400"
                style={{ width: `${(health.onHold / totalHealth) * 100}%` }}
              />
            )}
          </div>
        </div>
      )}

      {/* Compact metric strip */}
      <div className="w-full mt-auto pt-3 flex items-center justify-between text-[11px] gap-2">
        <MiniMetric label="Progress" value={`${stats.avgProgress}%`} />
        <span className="text-gray-200">·</span>
        <MiniMetric
          label="Budget"
          value={formatBudget(stats.totalBudget, stats.currency)}
        />
        <span className="text-gray-200">·</span>
        <MiniMetric
          label="At risk"
          value={riskCount.toString()}
          accent={riskCount > 0}
        />
      </div>
    </Card>
  );
}

function MiniMetric({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col items-center min-w-0">
      <span className="text-[10px] text-gray-400 uppercase tracking-wide truncate">
        {label}
      </span>
      <span
        className={cn(
          "font-semibold tabular-nums text-xs truncate",
          accent ? "text-[#a8893a]" : "text-black"
        )}
      >
        {value}
      </span>
    </div>
  );
}
