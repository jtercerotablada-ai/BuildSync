"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { MapPin, Loader2 } from "lucide-react";

// Shape used when prefilling the dialog in edit mode. Keep it
// permissive — only the id is required.
export interface ProjectInitial {
  id: string;
  projectNumber?: string | null;
  name?: string | null;
  type?: string | null;
  gate?: string | null;
  color?: string | null;
  clientName?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  budget?: number | string | null;
  currency?: string | null;
  description?: string | null;
}

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
  /** When set, the dialog opens in edit mode and PATCHes the given project. */
  initialProject?: ProjectInitial | null;
  /** Called after a successful edit (use to refresh the parent). */
  onProjectUpdated?: () => void;
}

const PROJECT_COLORS = [
  { value: "#F06A6A", label: "Coral" },
  { value: "#4573D2", label: "Blue" },
  { value: "#5DA283", label: "Green" },
  { value: "#F1BD6C", label: "Yellow" },
  { value: "#8E7CC3", label: "Purple" },
  { value: "#E07A5F", label: "Orange" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#a8893a", label: "Bronze" },
];

const PROJECT_TYPES = [
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "DESIGN", label: "Design" },
  { value: "RECERTIFICATION", label: "Recertification" },
  { value: "PERMIT", label: "Permit" },
];

const PROJECT_GATES = [
  { value: "PRE_DESIGN", label: "Pre-Design" },
  { value: "DESIGN", label: "Design" },
  { value: "PERMITTING", label: "Permitting" },
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "CLOSEOUT", label: "Closeout" },
];

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "COP", label: "COP — Colombian Peso" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
];

function toDateInput(value: string | null | undefined): string {
  if (!value) return "";
  // accept ISO strings ("2026-05-11T00:00:00.000Z") or plain "yyyy-mm-dd"
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
  initialProject,
  onProjectUpdated,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isEdit = !!initialProject;

  // Basics
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("");
  const [gate, setGate] = useState<string>("PRE_DESIGN");
  const [color, setColor] = useState("#4573D2");

  // Client & location
  const [clientName, setClientName] = useState("");
  const [location, setLocation] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [geocodeStatus, setGeocodeStatus] = useState<"idle" | "ok" | "miss">("idle");

  // Schedule & budget
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("USD");

  // Description
  const [description, setDescription] = useState("");

  const resetForm = () => {
    setName("");
    setType("");
    setGate("PRE_DESIGN");
    setColor("#4573D2");
    setClientName("");
    setLocation("");
    setLatitude(null);
    setLongitude(null);
    setGeocodeStatus("idle");
    setStartDate("");
    setEndDate("");
    setBudget("");
    setCurrency("USD");
    setDescription("");
  };

  // Prefill from initialProject whenever the dialog opens in edit mode.
  useEffect(() => {
    if (!open) return;
    if (initialProject) {
      setName(initialProject.name ?? "");
      setType(initialProject.type ?? "");
      setGate(initialProject.gate ?? "PRE_DESIGN");
      setColor(initialProject.color ?? "#4573D2");
      setClientName(initialProject.clientName ?? "");
      setLocation(initialProject.location ?? "");
      setLatitude(initialProject.latitude ?? null);
      setLongitude(initialProject.longitude ?? null);
      setGeocodeStatus(initialProject.latitude && initialProject.longitude ? "ok" : "idle");
      setStartDate(toDateInput(initialProject.startDate));
      setEndDate(toDateInput(initialProject.endDate));
      setBudget(initialProject.budget != null ? String(initialProject.budget) : "");
      setCurrency(initialProject.currency ?? "USD");
      setDescription(initialProject.description ?? "");
    } else {
      resetForm();
    }
  }, [open, initialProject]);

  // Geocode when the user leaves the location field. Silently no-ops on
  // failure — the user can still submit without coordinates.
  const handleLocationBlur = async () => {
    const q = location.trim();
    if (!q || (latitude !== null && longitude !== null)) return;
    setGeocoding(true);
    setGeocodeStatus("idle");
    try {
      const res = await fetch(`/api/geocode?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        setGeocodeStatus("miss");
        return;
      }
      const data = await res.json();
      if (data.found) {
        setLatitude(data.lat);
        setLongitude(data.lng);
        setGeocodeStatus("ok");
      } else {
        setGeocodeStatus("miss");
      }
    } catch {
      setGeocodeStatus("miss");
    } finally {
      setGeocoding(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Project name is required");
      return;
    }

    setLoading(true);
    try {
      // For PATCH: send nulls explicitly so clearing a field actually clears it.
      // For POST: omit empties so server defaults apply (e.g. gate=PRE_DESIGN).
      const buildPayload = (forEdit: boolean): Record<string, unknown> => {
        const p: Record<string, unknown> = {
          name: name.trim(),
          color,
        };
        const setField = (key: string, value: unknown, emptyMeansNull: boolean) => {
          if (value === "" || value === null || value === undefined) {
            if (forEdit) p[key] = emptyMeansNull ? null : undefined;
          } else {
            p[key] = value;
          }
        };
        setField("description", description.trim() || null, true);
        setField("type", type || null, true);
        if (gate) p.gate = gate; // gate has a server default
        setField("clientName", clientName.trim() || null, true);
        setField("location", location.trim() || null, true);
        setField("latitude", latitude, true);
        setField("longitude", longitude, true);
        setField("startDate", startDate || null, true);
        setField("endDate", endDate || null, true);
        const budgetNum = budget ? parseFloat(budget) : null;
        setField("budget", budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : null, true);
        if (currency) p.currency = currency;
        // Strip any explicit undefined so JSON.stringify doesn't drop a `null`
        Object.keys(p).forEach((k) => p[k] === undefined && delete p[k]);
        return p;
      };

      if (isEdit && initialProject) {
        const payload = buildPayload(true);
        const response = await fetch(`/api/projects/${initialProject.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to update project");
        toast.success("Project updated");
        onOpenChange(false);
        onProjectUpdated?.();
      } else {
        const payload = buildPayload(false);
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error("Failed to create project");
        const project = await response.json();
        toast.success(`Project ${project.projectNumber ?? ""} created`.trim());
        onOpenChange(false);
        resetForm();
        onProjectCreated?.();
        router.push(`/projects/${project.id}`);
      }
    } catch {
      toast.error(isEdit ? "Failed to update project" : "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEdit ? (
                <span className="flex items-center gap-2">
                  Edit project
                  {initialProject?.projectNumber && (
                    <span className="font-mono text-[12px] tracking-[0.5px] text-slate-400 font-normal">
                      {initialProject.projectNumber}
                    </span>
                  )}
                </span>
              ) : (
                "Create new project"
              )}
            </DialogTitle>
            <DialogDescription>
              {isEdit
                ? "Update any field below. Empty fields will clear the saved value."
                : "A project number will be assigned automatically once created."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 py-4">
            {/* ── Block 1: Basics ─────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-500">
                Basics
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="name">Project name *</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Brickell Mixed-Use Complex"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="type">Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger id="type">
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gate">Stage</Label>
                  <Select value={gate} onValueChange={setGate}>
                    <SelectTrigger id="gate">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_GATES.map((g) => (
                        <SelectItem key={g.value} value={g.value}>
                          {g.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="color">Color</Label>
                  <Select value={color} onValueChange={setColor}>
                    <SelectTrigger id="color">
                      <SelectValue>
                        <div className="flex items-center gap-2">
                          <div className="h-4 w-4 rounded" style={{ backgroundColor: color }} />
                          {PROJECT_COLORS.find((c) => c.value === color)?.label}
                        </div>
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {PROJECT_COLORS.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-4 rounded" style={{ backgroundColor: c.value }} />
                            {c.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* ── Block 2: Client & location ──────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-500">
                Client &amp; location
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="clientName">Client name</Label>
                  <Input
                    id="clientName"
                    placeholder="e.g., Brickell Capital Partners"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="location">
                    Location
                    {geocodeStatus === "ok" && (
                      <span className="ml-2 text-[11px] text-green-600 font-normal">
                        ✓ Pinned on map
                      </span>
                    )}
                    {geocodeStatus === "miss" && (
                      <span className="ml-2 text-[11px] text-amber-600 font-normal">
                        Location saved, not geocoded
                      </span>
                    )}
                  </Label>
                  <div className="relative">
                    <Input
                      id="location"
                      placeholder="Miami, FL"
                      value={location}
                      onChange={(e) => {
                        setLocation(e.target.value);
                        setLatitude(null);
                        setLongitude(null);
                        setGeocodeStatus("idle");
                      }}
                      onBlur={handleLocationBlur}
                      className="pr-9"
                    />
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                      {geocoding ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <MapPin className="w-4 h-4" />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Block 3: Schedule & budget ──────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-500">
                Schedule &amp; budget
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="startDate">Start date</Label>
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="endDate">Target completion</Label>
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="budget">Budget</Label>
                  <Input
                    id="budget"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="1000"
                    placeholder="e.g., 8400000"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="currency">Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger id="currency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            {/* ── Block 4: Description ────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-500">
                Description
              </h3>
              <Textarea
                id="description"
                placeholder="Brief project context — scope, key constraints, references…"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </section>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                onOpenChange(false);
                if (!isEdit) resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading
                ? isEdit
                  ? "Saving..."
                  : "Creating..."
                : isEdit
                ? "Save changes"
                : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
