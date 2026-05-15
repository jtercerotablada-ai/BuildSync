"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
  Briefcase,
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
  color: string;
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

  // ── Derived data ─────────────────────────────────────────────
  // Workspace KPI strip — sums across ALL visible portfolios so it's
  // not affected by tab/filter (Juan needs the global picture).
  const globalKpis = useMemo(() => {
    let projects = 0;
    let budget = 0;
    let atRisk = 0;
    let overdue = 0;
    let currency = "USD";
    for (const p of portfolios) {
      projects += p._count.projects;
      budget += p.stats.totalBudget;
      atRisk += p.stats.health.atRisk + p.stats.health.offTrack;
      overdue += p.stats.overdueTasks;
      if (p.stats.currency && p.stats.totalBudget > 0) {
        currency = p.stats.currency;
      }
    }
    return {
      portfolioCount: portfolios.length,
      projects,
      budget,
      atRisk,
      overdue,
      currency,
    };
  }, [portfolios]);

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
    <div className="p-4 md:p-6 max-w-[1400px] mx-auto">
      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4 md:mb-6">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-black">
            Portfolios
          </h1>
          <p className="text-xs md:text-sm text-gray-600 mt-1">
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
          <DialogContent className="max-w-3xl">
            {step === "config" ? (
              <CreateStepConfig
                value={newPortfolio}
                onChange={setNewPortfolio}
                onSubmit={handleCreate}
                creating={creating}
              />
            ) : (
              <CreateStepOnboarding
                portfolioName={newPortfolio.name}
                onAction={goToCreated}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Global KPI Strip ──────────────────────────────────── */}
      {portfolios.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiTile
            icon={<Folder className="h-4 w-4 text-[#a8893a]" />}
            label="Portfolios"
            value={globalKpis.portfolioCount.toString()}
          />
          <KpiTile
            icon={<Briefcase className="h-4 w-4 text-[#a8893a]" />}
            label="Projects"
            value={globalKpis.projects.toString()}
          />
          <KpiTile
            icon={<Wallet className="h-4 w-4 text-[#a8893a]" />}
            label="Total budget"
            value={formatBudget(globalKpis.budget, globalKpis.currency)}
          />
          <KpiTile
            icon={<AlertTriangle className="h-4 w-4 text-[#a8893a]" />}
            label="At-risk projects"
            value={globalKpis.atRisk.toString()}
            accent={globalKpis.atRisk > 0}
          />
        </div>
      )}

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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
          <Card
            className="p-6 border-2 border-dashed border-gray-200 hover:border-gray-400 hover:bg-gray-50 cursor-pointer transition-colors flex flex-col items-center justify-center text-center min-h-[200px]"
            onClick={() => setCreateOpen(true)}
          >
            <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-gray-600" />
            </div>
            <span className="text-sm font-medium text-gray-700">
              Create portfolio
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
  );
}

// ── Components ───────────────────────────────────────────────

function KpiTile({
  icon,
  label,
  value,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-white p-3 md:p-4",
        accent && "border-[#a8893a]/50 bg-[#a8893a]/5"
      )}
    >
      <div className="flex items-center gap-2 text-xs text-gray-500 uppercase tracking-wide">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-semibold text-black mt-1 tabular-nums">
        {value}
      </div>
    </div>
  );
}

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
}) {
  const views: { id: DefaultView; label: string; icon: React.ReactNode }[] = [
    { id: "list", label: "List", icon: <ListIcon className="h-4 w-4" /> },
    {
      id: "timeline",
      label: "Timeline",
      icon: <CalendarRange className="h-4 w-4" />,
    },
    {
      id: "panel",
      label: "Panel",
      icon: <LayoutDashboard className="h-4 w-4" />,
    },
    {
      id: "progress",
      label: "Progress",
      icon: <Activity className="h-4 w-4" />,
    },
    { id: "workload", label: "Workload", icon: <Users className="h-4 w-4" /> },
    {
      id: "messages",
      label: "Messages",
      icon: <MessageSquare className="h-4 w-4" />,
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
      description: "Only you and members you add can see this portfolio.",
      icon: <Lock className="h-4 w-4" />,
    },
    {
      value: "WORKSPACE",
      label: "Workspace members",
      description: "Anyone in your workspace can see this portfolio.",
      icon: <Users className="h-4 w-4" />,
    },
    {
      value: "PUBLIC",
      label: "Public",
      description: "Anyone with the link can view this portfolio.",
      icon: <Globe className="h-4 w-4" />,
    },
  ];

  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">New portfolio</DialogTitle>
      </DialogHeader>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 py-2">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Portfolio name</Label>
            <Input
              id="name"
              placeholder="e.g., Q1 Initiatives"
              value={value.name}
              onChange={(e) => onChange({ ...value, name: e.target.value })}
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Description (optional)</Label>
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
            <Label>Privacy</Label>
            <div className="space-y-1.5">
              {privacyOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onChange({ ...value, privacy: opt.value })}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-md border flex items-start gap-3 transition-colors",
                    value.privacy === opt.value
                      ? "border-black bg-gray-50"
                      : "border-gray-200 hover:border-gray-400"
                  )}
                >
                  <span
                    className={cn(
                      "mt-0.5",
                      value.privacy === opt.value
                        ? "text-black"
                        : "text-gray-500"
                    )}
                  >
                    {opt.icon}
                  </span>
                  <span className="flex-1">
                    <span className="block text-sm font-medium text-black">
                      {opt.label}
                    </span>
                    <span className="block text-xs text-gray-500 mt-0.5">
                      {opt.description}
                    </span>
                  </span>
                  {value.privacy === opt.value && (
                    <CheckCircle className="h-4 w-4 text-black flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Default view</Label>
            <div className="grid grid-cols-3 gap-2">
              {views.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => onChange({ ...value, defaultView: v.id })}
                  className={cn(
                    "flex flex-col items-center gap-1.5 px-3 py-3 rounded-md border transition-colors",
                    value.defaultView === v.id
                      ? "border-black bg-gray-50 text-black"
                      : "border-gray-200 text-gray-600 hover:border-gray-400"
                  )}
                >
                  {v.icon}
                  <span className="text-xs font-medium">{v.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Preview pane (Asana parity) */}
        <div className="bg-gray-50 rounded-lg border p-4 hidden md:flex md:flex-col">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Preview
          </div>
          <div className="flex-1 bg-white rounded border overflow-hidden">
            <div className="px-3 py-2 border-b flex items-center gap-2">
              <div className="w-6 h-6 bg-[#a8893a]/20 rounded flex items-center justify-center">
                <Folder className="h-3 w-3 text-[#a8893a]" />
              </div>
              <span className="text-sm font-medium text-black truncate">
                {value.name || "Your portfolio"}
              </span>
            </div>
            <div className="px-3 py-2 border-b flex gap-3 text-[10px] text-gray-500">
              {views.map((v) => (
                <span
                  key={v.id}
                  className={cn(
                    value.defaultView === v.id &&
                      "text-black font-medium border-b-2 border-black pb-1"
                  )}
                >
                  {v.label}
                </span>
              ))}
            </div>
            <div className="p-3 space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-gray-200" />
                  <div className="h-2 bg-gray-100 rounded flex-1" />
                  <div className="h-2 w-12 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button
          className="bg-black hover:bg-gray-800"
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
    </>
  );
}

function CreateStepOnboarding({
  portfolioName,
  onAction,
}: {
  portfolioName: string;
  onAction: (action: "add" | "share" | "open") => void;
}) {
  return (
    <>
      <DialogHeader>
        <DialogTitle className="text-xl">
          What do you want to do first?
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 py-4">
        <p className="text-sm text-gray-500">
          <strong className="text-black">{portfolioName}</strong> is ready. Pick
          where to go next:
        </p>

        <button
          onClick={() => onAction("add")}
          className="w-full text-left px-4 py-3 rounded-lg border-2 border-black bg-gray-50 hover:bg-gray-100 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-black flex items-center justify-center flex-shrink-0">
            <Plus className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-black">
              Start adding projects
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              Add projects and track their progress together.
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-black flex-shrink-0 mt-1" />
        </button>

        <button
          onClick={() => onAction("share")}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-400 flex items-start gap-3"
        >
          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Users className="h-4 w-4 text-gray-700" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-black">
              Share with teammates
            </div>
            <div className="text-xs text-gray-600 mt-0.5">
              Invite people to view or edit this portfolio.
            </div>
          </div>
          <ArrowRight className="h-4 w-4 text-gray-400 flex-shrink-0 mt-1" />
        </button>

        <button
          onClick={() => onAction("open")}
          className="w-full text-left px-4 py-3 rounded-lg border border-gray-200 hover:border-gray-400 flex items-center gap-3"
        >
          <ArrowRight className="h-4 w-4 text-gray-400" />
          <span className="text-sm text-gray-700">Just open the portfolio</span>
        </button>
      </div>
    </>
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

  return (
    <Card
      className="relative p-4 md:p-5 hover:shadow-md cursor-pointer transition-shadow min-h-[200px] flex flex-col group"
      onClick={onClick}
    >
      {/* Top row: icon + name + favorite */}
      <div className="flex items-start gap-3">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: (portfolio.color || "#a8893a") + "20" }}
        >
          <Folder
            className="h-5 w-5"
            style={{ color: portfolio.color || "#a8893a" }}
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <h3 className="font-medium text-black truncate min-w-0">
              {portfolio.name}
            </h3>
            <span
              className={cn(
                "w-2 h-2 rounded-full flex-shrink-0",
                meta.dot
              )}
              title={meta.label}
            />
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {_count.projects}{" "}
            {_count.projects === 1 ? "project" : "projects"}
          </p>
        </div>
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

      {portfolio.description && (
        <p className="text-xs text-gray-600 mt-2 line-clamp-2 break-words">
          {portfolio.description}
        </p>
      )}

      {/* Health distribution bar (Asana doesn't have this) */}
      {totalHealth > 0 && (
        <div className="mt-3">
          <div className="flex h-1.5 rounded-full overflow-hidden bg-gray-100">
            {health.onTrack > 0 && (
              <div
                className="bg-[#c9a84c]"
                style={{
                  width: `${(health.onTrack / totalHealth) * 100}%`,
                }}
              />
            )}
            {health.complete > 0 && (
              <div
                className="bg-[#a8893a]"
                style={{
                  width: `${(health.complete / totalHealth) * 100}%`,
                }}
              />
            )}
            {health.atRisk > 0 && (
              <div
                className="bg-amber-500"
                style={{
                  width: `${(health.atRisk / totalHealth) * 100}%`,
                }}
              />
            )}
            {health.offTrack > 0 && (
              <div
                className="bg-black"
                style={{
                  width: `${(health.offTrack / totalHealth) * 100}%`,
                }}
              />
            )}
            {health.onHold > 0 && (
              <div
                className="bg-gray-400"
                style={{
                  width: `${(health.onHold / totalHealth) * 100}%`,
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* Metric grid at bottom */}
      <div className="mt-auto pt-3 grid grid-cols-3 gap-2 text-xs">
        <div>
          <div className="text-gray-500 flex items-center gap-1">
            <TrendingUp className="h-3 w-3" /> Progress
          </div>
          <div className="font-semibold text-black tabular-nums">
            {stats.avgProgress}%
          </div>
        </div>
        <div>
          <div className="text-gray-500 flex items-center gap-1">
            <Wallet className="h-3 w-3" /> Budget
          </div>
          <div className="font-semibold text-black tabular-nums">
            {formatBudget(stats.totalBudget, stats.currency)}
          </div>
        </div>
        <div>
          <div className="text-gray-500 flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> At risk
          </div>
          <div
            className={cn(
              "font-semibold tabular-nums",
              riskCount > 0 ? "text-[#a8893a]" : "text-black"
            )}
          >
            {riskCount}
          </div>
        </div>
      </div>
    </Card>
  );
}
