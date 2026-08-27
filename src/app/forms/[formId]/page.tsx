"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import {
  Loader2,
  CheckCircle2,
  Upload,
  X,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  type FormField,
  type FormAnswerValue,
  type FormSubmissionPayload,
  type PublicFormRow,
  isFieldVisible,
} from "@/lib/form-types";

/**
 * Public form submission page. Anyone with the URL can fill it (or
 * any workspace member, depending on form.visibility).
 *
 * Renders ALL 10 field types defined in lib/form-types.ts, runs
 * branching logic in real time, uploads ATTACHMENT files as part of
 * the submit multipart payload, and respects ?embed=1 (strips chrome
 * for iframe embedding on external sites).
 */

/** Local attachment state — Files kept in memory until submit.
 *  Array because each ATTACHMENT field can carry multiple files
 *  (typical RFI: marked-up drawing + 2-3 site photos). */
type LocalAttachment = { file: File; previewUrl: string };

/** Per-file ceiling enforced by lib/storage.ts on the server. Mirrored
 *  here so an oversized file is caught at pick time, not after the
 *  submitter has filled in the whole form and waited out the upload. */
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

/** Same shape the browser's own type=email check enforced before this form
 *  went noValidate. Deliberately loose — we only reject addresses that can
 *  never route (no @, no dot, spaces); the receipt email is the real proof. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** An explicit `behavior: "smooth"` on scrollIntoView wins over the CSS
 *  `scroll-behavior` the reduced-motion media query sets, so the OS setting
 *  has to be read here instead. */
function scrollBehavior(): ScrollBehavior {
  return typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

export default function PublicFormPage() {
  const params = useParams<{ formId: string }>();
  const search = useSearchParams();
  const formId = params?.formId;
  const isEmbed = search?.get("embed") === "1";

  const [form, setForm] = useState<PublicFormRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [answers, setAnswers] = useState<FormSubmissionPayload>({});
  const [attachments, setAttachments] = useState<
    Record<string, LocalAttachment[]>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  // Validation messages from the last submit attempt, keyed by field id —
  // requiredness AND the format rules (email, number). Every problem is
  // marked at once instead of the submitter discovering them a toast at a
  // time.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [confirmationText, setConfirmationText] = useState<string | null>(null);
  // Signed URL the submitter can use to track status + reply later.
  // Returned by the submit API; surfaced on the thank-you screen +
  // sent in the receipt email.
  const [trackingUrl, setTrackingUrl] = useState<string | null>(null);
  const [copiedTracking, setCopiedTracking] = useState(false);

  // ── Fetch form schema ────────────────────────────────────────
  useEffect(() => {
    if (!formId) return;
    let canceled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/forms/${formId}`);
        if (!res.ok) {
          const body = await res.json().catch(() => null);
          throw new Error(
            body?.error ||
              (res.status === 404
                ? "Form not found"
                : res.status === 410
                  ? "This form is no longer accepting submissions."
                  : "Couldn't load this form")
          );
        }
        const data: PublicFormRow = await res.json();
        if (!canceled) setForm(data);
      } catch (err) {
        if (!canceled) {
          setLoadError(
            err instanceof Error ? err.message : "Couldn't load this form"
          );
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();
    return () => {
      canceled = true;
    };
  }, [formId]);

  // Map for O(1) field lookups during branching evaluation.
  const fieldsById = useMemo(() => {
    const m = new Map<string, FormField>();
    if (form) for (const f of form.fields) m.set(f.id, f);
    return m;
  }, [form]);

  // Recompute visible fields whenever answers change.
  const visibleFields = useMemo(() => {
    if (!form) return [] as FormField[];
    return form.fields.filter((f) =>
      isFieldVisible(f, answers, fieldsById)
    );
  }, [form, answers, fieldsById]);

  function clearFieldError(fieldId: string) {
    setFieldErrors((prev) => {
      if (prev[fieldId] === undefined) return prev;
      const next = { ...prev };
      delete next[fieldId];
      return next;
    });
  }

  function setAnswer(fieldId: string, value: FormAnswerValue) {
    clearFieldError(fieldId);
    setAnswers((prev) => {
      const next = { ...prev, [fieldId]: value };
      // When the user changes a SELECT/MULTI_SELECT, prune answers
      // for fields that just became hidden so we never persist a
      // value the user didn't actually see at submit time.
      if (!form) return next;
      const visible = new Set(
        form.fields
          .filter((f) => isFieldVisible(f, next, fieldsById))
          .map((f) => f.id)
      );
      for (const key of Object.keys(next)) {
        if (!visible.has(key)) {
          delete next[key];
        }
      }
      return next;
    });
    // Drop attachment state for fields that became hidden, too.
    setAttachments((prev) => {
      if (!form) return prev;
      const nextAnswers = { ...answers, [fieldId]: value };
      const visible = new Set(
        form.fields
          .filter((f) => isFieldVisible(f, nextAnswers, fieldsById))
          .map((f) => f.id)
      );
      const out: Record<string, LocalAttachment[]> = {};
      for (const [k, list] of Object.entries(prev)) {
        if (visible.has(k)) out[k] = list;
        else list.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      }
      return out;
    });
  }

  function addAttachments(fieldId: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    const picked = Array.from(files);
    const tooBig = picked.filter((f) => f.size > MAX_ATTACHMENT_BYTES);
    if (tooBig.length > 0) {
      toast.error(
        tooBig.length === 1
          ? `${tooBig[0].name} exceeds the 10MB limit`
          : `${tooBig.length} files exceed the 10MB limit and weren't added`
      );
    }
    const accepted = picked.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
    if (accepted.length === 0) return;
    clearFieldError(fieldId);
    setAttachments((prev) => {
      const existing = prev[fieldId] || [];
      const incoming: LocalAttachment[] = accepted.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
      }));
      return { ...prev, [fieldId]: [...existing, ...incoming] };
    });
  }

  function removeAttachmentAt(fieldId: string, index: number) {
    setAttachments((prev) => {
      const list = prev[fieldId] || [];
      const target = list[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      const next = list.filter((_, i) => i !== index);
      const out = { ...prev };
      if (next.length === 0) delete out[fieldId];
      else out[fieldId] = next;
      return out;
    });
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // Client-side validation honoring branching. Collect EVERY problem in
    // one pass — stopping at the first one meant a long intake form was
    // filled in by trial and error, one submit per missing answer.
    // Format rules live here too, not on the inputs: the form is noValidate,
    // so nothing else rejects "daniela@ttcivil" before it becomes the
    // submitter's contact address on the created task.
    const problems: { field: FormField; message: string }[] = [];
    for (const f of visibleFields) {
      if (f.type === "HEADING") continue;
      if (f.type === "ATTACHMENT") {
        const list = attachments[f.id] || [];
        if (f.required && list.length === 0) {
          problems.push({ field: f, message: "This field is required." });
        }
        continue;
      }
      const v = answers[f.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        if (f.required) {
          problems.push({ field: f, message: "This field is required." });
        }
        continue;
      }
      // An answered field still has to be well-formed. Optional fields are
      // checked too — a typo'd optional email is just as dead an address.
      const text = typeof v === "string" ? v.trim() : "";
      if (f.type === "EMAIL" && !EMAIL_PATTERN.test(text)) {
        problems.push({ field: f, message: "Enter a valid email address." });
      } else if (f.type === "NUMBER" && !Number.isFinite(Number(text))) {
        problems.push({ field: f, message: "Enter a number." });
      }
    }

    if (problems.length > 0) {
      setFieldErrors(
        Object.fromEntries(problems.map((p) => [p.field.id, p.message]))
      );
      toast.error(
        problems.length === 1
          ? `"${problems[0].field.label}" — ${problems[0].message}`
          : `${problems.length} fields need your attention`
      );
      // Take the submitter to the first one instead of leaving them to hunt
      // for it after the toast disappears.
      const first = problems[0].field;
      const container = document.getElementById(`form-field-${first.id}`);
      container?.scrollIntoView({
        behavior: scrollBehavior(),
        block: "center",
      });
      const control = document.getElementById(first.id);
      if (control instanceof HTMLElement) control.focus({ preventScroll: true });
      return;
    }

    setFieldErrors({});
    setSubmitting(true);
    try {
      // If any attachments are pending, send multipart; otherwise
      // plain JSON keeps the wire smaller.
      const hasAttachments = Object.keys(attachments).length > 0;
      let res: Response;
      if (hasAttachments) {
        const fd = new FormData();
        fd.append("answers", JSON.stringify(answers));
        // Each file goes under the same key `attachment:<fieldId>`
        // — the server uses formData.getAll() to collect them all.
        for (const [fieldId, list] of Object.entries(attachments)) {
          for (const att of list) {
            fd.append(`attachment:${fieldId}`, att.file, att.file.name);
          }
        }
        res = await fetch(`/api/forms/${form.id}/submit`, {
          method: "POST",
          body: fd,
        });
      } else {
        res = await fetch(`/api/forms/${form.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ answers }),
        });
      }

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Submission failed");
      }
      const body = await res.json().catch(() => null);
      setConfirmationText(
        body?.confirmationMessage ||
          "Thanks — the project team has been notified and your submission has been added to their backlog."
      );
      // Show the tracking URL on the thank-you screen so the
      // submitter can save it immediately (they also get it in
      // the receipt email but in-page is the safer bet — email
      // can land in spam).
      if (typeof body?.trackingUrl === "string") {
        setTrackingUrl(body.trackingUrl);
      }
      setSubmitted(true);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Submission failed");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (loadError || !form) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg border shadow-sm p-8 text-center">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Form unavailable
          </h1>
          <p className="text-sm text-slate-500">
            {loadError ||
              "We couldn't load this form. Double-check the link or contact the project owner."}
          </p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div
        className={cn(
          "min-h-screen flex items-center justify-center px-4",
          !isEmbed && "bg-slate-50"
        )}
      >
        <div className="max-w-md w-full bg-white rounded-lg border shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#c9a84c]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-[#a8893a]" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Submission received
          </h1>
          <p className="text-sm text-slate-500 whitespace-pre-wrap">
            {confirmationText}
          </p>

          {/* Tracking URL block — the differentiator. Lets the
              architect / owner save the link before the email
              even lands. "Open tracking page" routes them to the
              full view; "Copy link" lets them paste it into their
              own notes / project file. */}
          {trackingUrl && (
            <div className="mt-5 rounded-lg border border-[#e0c87a] bg-[#fdf7e8] px-4 py-3 text-left">
              <p className="text-[11px] uppercase tracking-[1.5px] text-[#8a7028] font-semibold mb-1">
                Track your submission
              </p>
              <p className="text-xs text-slate-600 mb-3 leading-relaxed">
                Save this private link to check status, see the team&apos;s
                responses, and add follow-up info — no account needed.
              </p>
              <div className="flex items-stretch gap-2">
                <input
                  readOnly
                  value={trackingUrl}
                  onClick={(e) =>
                    (e.target as HTMLInputElement).select()
                  }
                  className="flex-1 min-w-0 text-[11px] font-mono px-2 py-1.5 bg-white border border-slate-200 rounded text-slate-600 truncate"
                />
                <button
                  type="button"
                  onClick={async (e) => {
                    // Capture the input element BEFORE the await so the
                    // fallback branch still has a reference (React resets
                    // currentTarget after the synchronous handler returns).
                    const sibling = (
                      e.currentTarget as HTMLElement
                    ).parentElement?.querySelector("input");
                    try {
                      await navigator.clipboard.writeText(trackingUrl);
                      setCopiedTracking(true);
                      setTimeout(() => setCopiedTracking(false), 2000);
                    } catch {
                      // Clipboard API blocked (insecure context, Safari
                      // permissions, etc.) → select the input so the
                      // user can press ⌘C / Ctrl+C manually.
                      if (sibling instanceof HTMLInputElement) sibling.select();
                    }
                  }}
                  className="flex-shrink-0 text-xs font-medium px-2.5 py-1.5 bg-black text-white rounded hover:bg-gray-900"
                >
                  {copiedTracking ? "Copied!" : "Copy"}
                </button>
              </div>
              <a
                href={trackingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2.5 inline-block text-xs font-medium text-[#8a7028] hover:underline"
              >
                Open tracking page →
              </a>
            </div>
          )}

          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              // Asana parity: "Add another response" — reset form.
              setAnswers({});
              setAttachments({});
              setFieldErrors({});
              setSubmitted(false);
              setConfirmationText(null);
              setTrackingUrl(null);
            }}
          >
            Submit another response
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "min-h-screen px-4",
        isEmbed ? "py-4" : "bg-slate-50 py-10"
      )}
    >
      <div className="max-w-2xl mx-auto">
        {!isEmbed && (
          <header className="text-center mb-6">
            <h1 className="text-2xl font-semibold text-slate-900">
              {form.name}
            </h1>
            {form.description && (
              <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
                {form.description}
              </p>
            )}
            {form.visibility === "ORGANIZATION" && (
              <p className="mt-2 inline-flex items-center gap-1 text-[11px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                <Lock className="h-3 w-3" />
                Organization-only · sign-in required
              </p>
            )}
          </header>
        )}

        {isEmbed && (
          <header className="mb-4">
            <h1 className="text-lg font-semibold text-slate-900">
              {form.name}
            </h1>
            {form.description && (
              <p className="mt-1 text-xs text-slate-600 whitespace-pre-wrap">
                {form.description}
              </p>
            )}
          </header>
        )}

        {/* noValidate: one validator, one look. With native validation on,
            six of the field types showed the browser's own bubble on the
            first empty one while SELECT / MULTI_SELECT / ATTACHMENT could
            only be caught by the pass in handleSubmit — two unrelated error
            UIs for the same rule, and the collected pass never ran until
            the native ones were satisfied. Everything the browser used to
            check, including EMAIL and NUMBER format, is re-implemented in
            handleSubmit — turning this off must not lose a rule. */}
        <form
          onSubmit={handleSubmit}
          noValidate
          className="bg-white rounded-lg border shadow-sm p-6 space-y-5"
        >
          {visibleFields.map((field) =>
            field.type === "HEADING" ? (
              <h2
                key={field.id}
                className="text-sm font-semibold text-slate-900 pt-2 first:pt-0 border-t first:border-t-0 border-slate-200 -mx-6 px-6 pb-1"
              >
                {field.label}
              </h2>
            ) : (
              <div
                key={field.id}
                id={`form-field-${field.id}`}
                className="space-y-1.5"
              >
                <label
                  htmlFor={field.id}
                  className="text-sm font-medium text-slate-700 flex items-center gap-1"
                >
                  {field.label}
                  {field.required && (
                    <span
                      className="text-[#a8893a]"
                      aria-label="required"
                    >
                      *
                    </span>
                  )}
                  {field.unit && (
                    <span className="ml-1 text-[11px] text-slate-400">
                      ({field.unit})
                    </span>
                  )}
                </label>
                {field.helpText && (
                  <p className="text-[11px] text-slate-500">
                    {field.helpText}
                  </p>
                )}
                <FieldInput
                  field={field}
                  value={answers[field.id] ?? null}
                  attachmentList={attachments[field.id] || []}
                  error={fieldErrors[field.id] ?? null}
                  onChange={(v) => setAnswer(field.id, v)}
                  onAddAttachments={(files) =>
                    addAttachments(field.id, files)
                  }
                  onRemoveAttachmentAt={(idx) =>
                    removeAttachmentAt(field.id, idx)
                  }
                />
                {fieldErrors[field.id] && (
                  <p
                    id={`form-field-${field.id}-error`}
                    className="text-[11px] text-rose-600"
                  >
                    {fieldErrors[field.id]}
                  </p>
                )}
              </div>
            )
          )}

          <div className="flex items-center justify-end pt-2 border-t">
            <Button
              type="submit"
              disabled={submitting}
              className="bg-black hover:bg-gray-900 text-white"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Sending…
                </>
              ) : (
                "Submit"
              )}
            </Button>
          </div>
        </form>

        {!isEmbed && (
          <p className="text-[11px] text-slate-400 text-center mt-4">
            Powered by Tercero Tablada
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Field renderer ─────────────────────────────────────────────

function FieldInput({
  field,
  value,
  attachmentList,
  error,
  onChange,
  onAddAttachments,
  onRemoveAttachmentAt,
}: {
  field: FormField;
  value: FormAnswerValue;
  attachmentList: LocalAttachment[];
  error: string | null;
  onChange: (v: FormAnswerValue) => void;
  onAddAttachments: (files: FileList | null) => void;
  onRemoveAttachmentAt: (index: number) => void;
}) {
  // Controls carry aria-required rather than the native `required`: the
  // form is noValidate, so requiredness is announced to screen readers but
  // enforced in one place (handleSubmit) for every field type alike.
  // Red outline on the control the submitter still has to fix.
  const invalid = error != null;
  const invalidCls = invalid
    ? "border-rose-400 focus-visible:ring-rose-400"
    : undefined;
  // Point at the message the parent renders, so a screen reader reads
  // "enter a valid email address" and not just "invalid entry".
  const errorId = invalid ? `form-field-${field.id}-error` : undefined;

  switch (field.type) {
    case "TEXT":
      return (
        <Input
          id={field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={invalidCls}
        />
      );

    case "EMAIL":
      return (
        <Input
          id={field.id}
          type="email"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "you@example.com"}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={invalidCls}
        />
      );

    case "TEXTAREA":
      return (
        <Textarea
          id={field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          rows={4}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={cn("resize-none", invalidCls)}
        />
      );

    case "DATE":
      return (
        <Input
          id={field.id}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={invalidCls}
        />
      );

    case "NUMBER":
      return (
        <Input
          id={field.id}
          type="number"
          inputMode="decimal"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={invalidCls}
        />
      );

    case "PEOPLE":
      // Public forms can't authoritatively pick a user — we just
      // capture the typed name. The admin sees the name as raw text
      // in the auto-created task.
      return (
        <Input
          id={field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "Full name"}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={invalidCls}
        />
      );

    case "SELECT":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        >
          <SelectTrigger
            id={field.id}
            aria-invalid={invalid || undefined}
            aria-describedby={errorId}
            className={invalidCls}
          >
            <SelectValue placeholder={field.placeholder || "Choose…"} />
          </SelectTrigger>
          <SelectContent>
            {(field.options || []).map((opt) => (
              <SelectItem key={opt} value={opt}>
                {opt}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "MULTI_SELECT": {
      // MULTI_SELECT only stores string[]; the wider FormAnswerValue
      // union includes attachment[] for ATTACHMENT, narrow here.
      const selected: string[] = Array.isArray(value)
        ? (value as string[])
        : [];
      return (
        // The checkbox group is the "control" here: it carries the field id
        // so the wrapper <label htmlFor> and handleSubmit's focus-the-first-
        // problem step land on something, and tabIndex -1 makes it focusable
        // programmatically without adding a tab stop.
        <div
          id={field.id}
          role="group"
          tabIndex={-1}
          aria-label={field.label}
          aria-required={field.required || undefined}
          aria-invalid={invalid || undefined}
          aria-describedby={errorId}
          className={cn(
            "space-y-2 border rounded-md p-2.5 bg-slate-50/40 focus:outline-none",
            invalidCls
          )}
        >
          {(field.options || []).map((opt) => {
            const checked = selected.includes(opt);
            return (
              <label
                key={opt}
                className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer"
              >
                <Checkbox
                  checked={checked}
                  onCheckedChange={(c) => {
                    const next = new Set(selected);
                    if (c === true) next.add(opt);
                    else next.delete(opt);
                    onChange(Array.from(next));
                  }}
                />
                {opt}
              </label>
            );
          })}
          {(field.options || []).length === 0 && (
            <p className="text-xs text-slate-400 italic">No options set.</p>
          )}
        </div>
      );
    }

    case "ATTACHMENT": {
      // Multiple-file support: the user can pick several at once
      // (Ctrl/Cmd-click in the picker) or drop another batch — they
      // append to the list. Each row has its own remove ✕.
      return (
        <div className="space-y-2">
          {attachmentList.length > 0 && (
            <ul className="space-y-1.5">
              {attachmentList.map((att, idx) => (
                <li
                  key={`${att.file.name}-${idx}`}
                  className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 bg-slate-50"
                >
                  <Upload className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                  <span className="flex-1 truncate text-slate-700">
                    {att.file.name}
                  </span>
                  <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                    {Math.round(att.file.size / 1024)} KB
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemoveAttachmentAt(idx)}
                    className="p-1 text-slate-400 hover:text-rose-600"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label
            htmlFor={field.id}
            className={cn(
              "flex items-center gap-2 text-sm border border-dashed rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 text-slate-600",
              invalidCls
            )}
          >
            <Upload className="h-4 w-4 text-slate-400" />
            <span>
              {attachmentList.length === 0
                ? "Choose files…"
                : "Add more files"}
            </span>
            <input
              id={field.id}
              type="file"
              multiple
              className="sr-only"
              accept={field.accept?.join(",")}
              aria-required={field.required || undefined}
              aria-invalid={invalid || undefined}
              aria-describedby={errorId}
              onChange={(e) => {
                onAddAttachments(e.target.files);
                // Reset value so the same file can be re-added if
                // the user deleted it.
                e.target.value = "";
              }}
            />
          </label>
        </div>
      );
    }

    case "HEADING":
      // Heading is rendered at the parent level — never as an input.
      return null;
  }
}
