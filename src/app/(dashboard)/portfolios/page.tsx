"use client";

import { useEffect, useState } from "react";
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
import { Plus, Folder, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Portfolio {
  id: string;
  name: string;
  description: string | null;
  color: string;
  status: string;
  owner: {
    id: string;
    name: string | null;
    image: string | null;
  };
  _count: {
    projects: number;
  };
}

export default function PortfoliosPage() {
  const router = useRouter();
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({
    name: "",
    description: "",
  });

  useEffect(() => {
    fetchPortfolios();
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
        body: JSON.stringify(newPortfolio),
      });

      if (res.ok) {
        const portfolio = await res.json();
        setPortfolios([portfolio, ...portfolios]);
        setCreateOpen(false);
        setNewPortfolio({ name: "", description: "" });
        toast.success("Portfolio created");
        router.push(`/portfolios/${portfolio.id}`);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ON_TRACK":
        return "bg-[#c9a84c]";
      case "AT_RISK":
        return "bg-[#a8893a]";
      case "OFF_TRACK":
        return "bg-black";
      case "COMPLETE":
        return "bg-[#c9a84c]";
      default:
        return "bg-gray-400";
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-black" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-xl md:text-2xl font-semibold text-black">Portfolios</h1>
          <p className="text-xs md:text-sm text-black mt-1">
            Organize and track multiple projects together
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button className="bg-black hover:bg-black w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Create portfolio
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create new portfolio</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Portfolio name</Label>
                <Input
                  id="name"
                  placeholder="e.g., Q1 Initiatives"
                  value={newPortfolio.name}
                  onChange={(e) =>
                    setNewPortfolio({ ...newPortfolio, name: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description (optional)</Label>
                <Textarea
                  id="description"
                  placeholder="What is this portfolio for?"
                  value={newPortfolio.description}
                  onChange={(e) =>
                    setNewPortfolio({
                      ...newPortfolio,
                      description: e.target.value,
                    })
                  }
                />
              </div>
              <Button
                className="w-full bg-black hover:bg-black"
                onClick={handleCreate}
                disabled={creating || !newPortfolio.name.trim()}
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create portfolio"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Portfolio Grid */}
      {portfolios.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
            <Folder className="h-8 w-8 text-black" />
          </div>
          <h2 className="text-lg font-medium text-black mb-2">
            No portfolios yet
          </h2>
          <p className="text-sm text-black max-w-md mb-4">
            Create a portfolio to group related projects and track their
            progress together.
          </p>
          <Button
            onClick={() => setCreateOpen(true)}
            className="bg-black hover:bg-black"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create your first portfolio
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {/* Create Card */}
          <Card
            className="p-6 border-2 border-dashed border-slate-200 hover:border-slate-300 cursor-pointer transition-colors flex flex-col items-center justify-center text-center min-h-[160px]"
            onClick={() => setCreateOpen(true)}
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
              <Plus className="h-5 w-5 text-slate-600" />
            </div>
            <span className="text-sm font-medium text-slate-700">
              Create portfolio
            </span>
          </Card>

          {/* Portfolio Cards */}
          {portfolios.map((portfolio) => (
            <Card
              key={portfolio.id}
              className="p-4 md:p-6 hover:shadow-md cursor-pointer transition-shadow min-h-[160px] flex flex-col"
              onClick={() => router.push(`/portfolios/${portfolio.id}`)}
            >
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: portfolio.color + "20" }}
                >
                  <Folder
                    className="h-5 w-5"
                    style={{ color: portfolio.color }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 min-w-0">
                    <h3 className="font-medium text-black truncate min-w-0">
                      {portfolio.name}
                    </h3>
                    <div
                      className={`w-2 h-2 rounded-full flex-shrink-0 ${getStatusColor(
                        portfolio.status
                      )}`}
                    />
                  </div>
                  <p className="text-xs md:text-sm text-gray-500 mt-1">
                    {portfolio._count.projects}{" "}
                    {portfolio._count.projects === 1 ? "project" : "projects"}
                  </p>
                </div>
              </div>
              {portfolio.description && (
                <p className="text-xs md:text-sm text-gray-600 mt-3 line-clamp-2 break-words">
                  {portfolio.description}
                </p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
