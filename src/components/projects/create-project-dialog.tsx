"use client";

import { useEffect, useRef, useState } from "react";
import type { ProjectType } from "@prisma/client";
import { usePathname, useRouter } from "next/navigation";
import { notifySidebarRefresh } from "@/lib/open-create-project";
import {
  isStageValidForType,
  stageLabel,
  stagesForType,
} from "@/lib/pipelines";
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
import {
  REFERENCE_LABEL,
  deadlineCopyFor,
  isValidEmail,
  isValidPhone,
  referenceFieldsFor,
  type ReferenceField,
} from "@/lib/regulatory";
import { AhjDatalist } from "@/components/projects/ahj-datalist";

// Shape used when prefilling the dialog in edit mode. Keep it
// permissive — only the id is required.
export interface ProjectInitial {
  id: string;
  projectNumber?: string | null;
  name?: string | null;
  type?: string | null;
  /** Current pipeline stage key — lets the dialog warn before a Type change
   *  that would reset it. */
  stage?: string | null;
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
  // Jurisdiction & regulatory data (src/lib/regulatory.ts)
  jurisdiction?: string | null;
  folioNumber?: string | null;
  permitNumber?: string | null;
  caseNumber?: string | null;
  regulatoryDeadline?: string | null;
  clientContactName?: string | null;
  clientContactEmail?: string | null;
  clientContactPhone?: string | null;
}

const REFERENCE_PLACEHOLDER: Record<ReferenceField, string> = {
  folioNumber: "e.g., 01-3131-051-0010",
  permitNumber: "e.g., BD25-004512",
  caseNumber: "e.g., 2025-RC-00123",
};

interface CreateProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProjectCreated?: () => void;
  /** When set, the dialog opens in edit mode and PATCHes the given project. */
  initialProject?: ProjectInitial | null;
  /** Called after a successful edit (use to refresh the parent). */
  onProjectUpdated?: () => void;
  /** Create mode only: share the new project with this team (the gallery's
   *  team context carried into the blank form). Ignored when editing. */
  teamId?: string | null;
}

// Monochrome + gold palette only — six shades along black → white → gold.
// Keeps the visual language consistent across the whole product.
const PROJECT_COLORS = [
  { value: "#0a0a0a", label: "Black" },
  { value: "#4a4a4a", label: "Charcoal" },
  { value: "#888888", label: "Gray" },
  { value: "#d4b65a", label: "Bright gold" },
  { value: "#c9a84c", label: "Gold" },
  { value: "#a8893a", label: "Bronze" },
];

const PROJECT_TYPES = [
  { value: "CONSTRUCTION", label: "Construction" },
  { value: "DESIGN", label: "Design" },
  { value: "RECERTIFICATION", label: "Recertification" },
  // Broward's Building Structural Integrity Program — the same work as a
  // Miami-Dade recertification, kept apart so the two counties can be counted
  // separately.
  { value: "BSIP", label: "BSIP (Broward)" },
  { value: "PERMIT", label: "Permit" },
];

const CURRENCIES = [
  { value: "USD", label: "USD — US Dollar" },
  { value: "MXN", label: "MXN — Mexican Peso" },
  { value: "COP", label: "COP — Colombian Peso" },
  { value: "EUR", label: "EUR — Euro" },
  { value: "GBP", label: "GBP — British Pound" },
  { value: "CAD", label: "CAD — Canadian Dollar" },
];

/** The route's error text, or `fallback` when the body has none. */
async function responseError(res: Response, fallback: string): Promise<string> {
  const data = await res.json().catch(() => null);
  return typeof data?.error === "string" && data.error ? data.error : fallback;
}

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
  teamId,
}: CreateProjectDialogProps) {
  const router = useRouter();
  // Mounted in both shells; a new project opens in the one the user is in.
  const pathname = usePathname();
  const shellPrefix = pathname?.startsWith("/portal") ? "/portal" : "";
  const [loading, setLoading] = useState(false);

  const isEdit = !!initialProject;

  // Basics
  const [name, setName] = useState("");
  const [type, setType] = useState<string>("");
  const [color, setColor] = useState("#c9a84c");

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

  // Client contact
  const [clientContactName, setClientContactName] = useState("");
  const [clientContactEmail, setClientContactEmail] = useState("");
  const [clientContactPhone, setClientContactPhone] = useState("");
  // Inline contact errors, shown after blur (and on a blocked submit).
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  // Site & jurisdiction
  const [jurisdiction, setJurisdiction] = useState("");
  const [folioNumber, setFolioNumber] = useState("");
  const [permitNumber, setPermitNumber] = useState("");
  const [caseNumber, setCaseNumber] = useState("");
  const [regulatoryDeadline, setRegulatoryDeadline] = useState("");

  const resetForm = () => {
    setClientContactName("");
    setClientContactEmail("");
    setClientContactPhone("");
    setEmailError(null);
    setPhoneError(null);
    setJurisdiction("");
    setFolioNumber("");
    setPermitNumber("");
    setCaseNumber("");
    setRegulatoryDeadline("");
    setName("");
    setType("");
    setColor("#c9a84c");
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

  // Prefill once per opening. Running on every `initialProject` change would
  // reset the form whenever the parent re-renders with a new object (e.g. a
  // session refetch on window focus) and throw away what the user typed.
  const wasOpenRef = useRef(false);
  useEffect(() => {
    if (!open) {
      wasOpenRef.current = false;
      return;
    }
    if (wasOpenRef.current) return;
    wasOpenRef.current = true;
    if (initialProject) {
      setName(initialProject.name ?? "");
      setType(initialProject.type ?? "");
      setColor(initialProject.color ?? "#c9a84c");
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
      setClientContactName(initialProject.clientContactName ?? "");
      setClientContactEmail(initialProject.clientContactEmail ?? "");
      setClientContactPhone(initialProject.clientContactPhone ?? "");
      setEmailError(null);
      setPhoneError(null);
      setJurisdiction(initialProject.jurisdiction ?? "");
      setFolioNumber(initialProject.folioNumber ?? "");
      setPermitNumber(initialProject.permitNumber ?? "");
      setCaseNumber(initialProject.caseNumber ?? "");
      setRegulatoryDeadline(toDateInput(initialProject.regulatoryDeadline));
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
    // Same rules the server applies (regulatory-schema.ts), checked here so
    // the error sits next to the field instead of only in a toast.
    const emailTrim = clientContactEmail.trim();
    if (emailTrim && !isValidEmail(emailTrim)) {
      setEmailError("Enter a valid email");
      toast.error("Check the contact email");
      return;
    }
    const phoneTrim = clientContactPhone.trim();
    if (phoneTrim && !isValidPhone(phoneTrim)) {
      setPhoneError("Enter a valid phone number");
      toast.error("Check the contact phone");
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
        setField("clientName", clientName.trim() || null, true);
        setField("location", location.trim() || null, true);
        setField("latitude", latitude, true);
        setField("longitude", longitude, true);
        setField("startDate", startDate || null, true);
        setField("endDate", endDate || null, true);
        const budgetNum = budget ? parseFloat(budget) : null;
        setField("budget", budgetNum != null && !Number.isNaN(budgetNum) ? budgetNum : null, true);
        setField("jurisdiction", jurisdiction.trim() || null, true);
        setField("folioNumber", folioNumber.trim() || null, true);
        setField("permitNumber", permitNumber.trim() || null, true);
        setField("caseNumber", caseNumber.trim() || null, true);
        // The date input already yields "YYYY-MM-DD".
        setField("regulatoryDeadline", regulatoryDeadline || null, true);
        setField("clientContactName", clientContactName.trim() || null, true);
        setField("clientContactEmail", clientContactEmail.trim() || null, true);
        setField("clientContactPhone", clientContactPhone.trim() || null, true);
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
        if (!response.ok) {
          throw new Error(await responseError(response, "Failed to update project"));
        }
        toast.success("Project updated");
        notifySidebarRefresh();
        onOpenChange(false);
        onProjectUpdated?.();
      } else {
        const payload = buildPayload(false);
        // The route's schema is `z.string().optional()`: omit, never null.
        if (teamId) payload.teamId = teamId;
        const response = await fetch("/api/projects", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!response.ok) {
          throw new Error(await responseError(response, "Failed to create project"));
        }
        const project = await response.json();
        toast.success(`Project ${project.projectNumber ?? ""} created`.trim());
        notifySidebarRefresh();
        onOpenChange(false);
        resetForm();
        onProjectCreated?.();
        router.push(`${shellPrefix}/projects/${project.id}`);
      }
    } catch (err) {
      toast.error(
        err instanceof Error && err.message
          ? err.message
          : isEdit
            ? "Failed to update project"
            : "Failed to create project"
      );
    } finally {
      setLoading(false);
    }
  };

  // The server moves the job to the first stage of the new pipeline when its
  // current stage does not belong there, and switching back does not restore
  // it. Say so before Save rather than let the stage vanish silently.
  const currentStage = initialProject?.stage ?? null;
  const typeChanged = isEdit && type !== (initialProject?.type ?? "");
  const stageWillReset =
    typeChanged &&
    !!currentStage &&
    !isStageValidForType((type || null) as ProjectType | null, currentStage);
  const resetTo = stageWillReset
    ? stagesForType((type || null) as ProjectType | null)[0] ?? null
    : null;

  // Relabels live as the Type changes; typed values are kept either way.
  const deadlineCopy = deadlineCopyFor(type || null);
  const referenceValues: Record<ReferenceField, [string, (v: string) => void]> = {
    folioNumber: [folioNumber, setFolioNumber],
    permitNumber: [permitNumber, setPermitNumber],
    caseNumber: [caseNumber, setCaseNumber],
  };
  const visibleReferences: ReferenceField[] = referenceFieldsFor(type || null);
  // A case number already typed stays visible after switching to a type that
  // does not normally carry one, so it can still be seen and cleared.
  if (!visibleReferences.includes("caseNumber") && caseNumber.trim()) {
    visibleReferences.push("caseNumber");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* noValidate: the browser's type=email bubble would otherwise pre-empt
            our own inline errors and toasts. */}
        <form onSubmit={handleSubmit} noValidate>
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
                  {stageWillReset && (
                    <p className="text-[12px] text-amber-800" role="note">
                      The current stage ({stageLabel(currentStage) ?? currentStage})
                      doesn&apos;t exist for this type.{" "}
                      {resetTo
                        ? `Saving moves the job to "${resetTo.label}", and switching the type back won't restore it.`
                        : "Saving clears the stage, and switching the type back won't restore it."}
                    </p>
                  )}
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

            {/* ── Block 2: Client ─────────────────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-500">
                Client
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="clientName">Client name</Label>
                  <Input
                    id="clientName"
                    placeholder="e.g., Brickell Capital Partners"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="clientContactName">Contact person</Label>
                  <Input
                    id="clientContactName"
                    placeholder="e.g., Ana Pérez, board president"
                    maxLength={120}
                    value={clientContactName}
                    onChange={(e) => setClientContactName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientContactEmail">Contact email</Label>
                  <Input
                    id="clientContactEmail"
                    type="email"
                    inputMode="email"
                    autoComplete="off"
                    placeholder="name@company.com"
                    maxLength={254}
                    value={clientContactEmail}
                    aria-invalid={!!emailError}
                    aria-describedby={emailError ? "clientContactEmail-error" : undefined}
                    onChange={(e) => {
                      setClientContactEmail(e.target.value);
                      if (emailError) setEmailError(null);
                    }}
                    onBlur={() => {
                      const v = clientContactEmail.trim();
                      setEmailError(v && !isValidEmail(v) ? "Enter a valid email" : null);
                    }}
                    className={emailError ? "border-red-300 focus-visible:ring-red-200" : undefined}
                  />
                  {emailError && (
                    <p id="clientContactEmail-error" className="text-[11px] text-red-600">
                      {emailError}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="clientContactPhone">Contact phone</Label>
                  <Input
                    id="clientContactPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="(305) 555-0142"
                    maxLength={40}
                    value={clientContactPhone}
                    aria-invalid={!!phoneError}
                    aria-describedby={phoneError ? "clientContactPhone-error" : undefined}
                    onChange={(e) => {
                      setClientContactPhone(e.target.value);
                      if (phoneError) setPhoneError(null);
                    }}
                    onBlur={() => {
                      const v = clientContactPhone.trim();
                      setPhoneError(v && !isValidPhone(v) ? "Enter a valid phone number" : null);
                    }}
                    className={phoneError ? "border-red-300 focus-visible:ring-red-200" : undefined}
                  />
                  {phoneError && (
                    <p id="clientContactPhone-error" className="text-[11px] text-red-600">
                      {phoneError}
                    </p>
                  )}
                </div>
              </div>
            </section>

            {/* ── Block 3: Site & jurisdiction ────────────────────────── */}
            <section className="space-y-3">
              <h3 className="text-[11px] font-semibold tracking-[2px] uppercase text-gray-500">
                Site &amp; jurisdiction
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="location">
                    Location
                    {geocodeStatus === "ok" && (
                      <span className="ml-2 text-[11px] text-[#a8893a] font-normal">
                        ✓ Pinned on map
                      </span>
                    )}
                    {geocodeStatus === "miss" && (
                      <span className="ml-2 text-[11px] text-[#a8893a] font-normal">
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
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="jurisdiction">Jurisdiction (AHJ)</Label>
                  <Input
                    id="jurisdiction"
                    list="ahj-options"
                    maxLength={120}
                    autoComplete="off"
                    placeholder="e.g., City of Hialeah"
                    value={jurisdiction}
                    onChange={(e) => setJurisdiction(e.target.value)}
                  />
                  <AhjDatalist id="ahj-options" />
                  <p className="text-[11px] text-gray-500">
                    Pick a suggestion or type any authority.
                  </p>
                </div>
                {visibleReferences.map((field) => {
                  const [value, setValue] = referenceValues[field];
                  return (
                    <div key={field} className="space-y-1.5">
                      <Label htmlFor={field}>{REFERENCE_LABEL[field]}</Label>
                      <Input
                        id={field}
                        className="font-mono"
                        autoComplete="off"
                        maxLength={field === "folioNumber" ? 32 : 64}
                        placeholder={REFERENCE_PLACEHOLDER[field]}
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                      />
                    </div>
                  );
                })}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="regulatoryDeadline">{deadlineCopy.label}</Label>
                  <Input
                    id="regulatoryDeadline"
                    type="date"
                    className="sm:max-w-[50%]"
                    value={regulatoryDeadline}
                    onChange={(e) => setRegulatoryDeadline(e.target.value)}
                  />
                  <p className="text-[11px] text-gray-500">{deadlineCopy.help}</p>
                </div>
              </div>
            </section>

            {/* ── Block 4: Schedule & budget ──────────────────────────── */}
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

            {/* ── Block 5: Description ────────────────────────────────── */}
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
