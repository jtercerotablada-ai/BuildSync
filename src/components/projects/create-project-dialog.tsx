"use client";

import { useState } from "react";
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

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
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

export function CreateProjectDialog({
  open,
  onOpenChange,
  onProjectCreated,
}: CreateProjectDialogProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

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

  // Geocode when the user moves out of the location field. Fires only if
  // there's text and no cached lat/lng. Silently no-ops on failure — the
  // user can still create the project without coordinates.
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
      const payload: Record<string, unknown> = {
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      };
      if (type) payload.type = type;
      if (gate) payload.gate = gate;
      if (clientName.trim()) payload.clientName = clientName.trim();
      if (location.trim()) payload.location = location.trim();
      if (latitude !== null) payload.latitude = latitude;
      if (longitude !== null) payload.longitude = longitude;
      if (startDate) payload.startDate = startDate;
      if (endDate) payload.endDate = endDate;
      if (budget) {
        const n = parseFloat(budget);
        if (!Number.isNaN(n)) payload.budget = n;
      }
      if (currency) payload.currency = currency;

      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error("Failed to create project");
      }

      const project = await response.json();
      toast.success(`Project ${project.projectNumber ?? ""} created`.trim());
      onOpenChange(false);
      resetForm();
      onProjectCreated?.();
      router.push(`/projects/${project.id}`);
    } catch {
      toast.error("Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create new project</DialogTitle>
            <DialogDescription>
              A project number will be assigned automatically once created.
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
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create project"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
