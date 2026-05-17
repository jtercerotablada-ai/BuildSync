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

/** Local attachment state — File kept in memory until submit. */
type LocalAttachment = { file: File; previewUrl: string };

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
    Record<string, LocalAttachment>
  >({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [confirmationText, setConfirmationText] = useState<string | null>(null);

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

  function setAnswer(fieldId: string, value: FormAnswerValue) {
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
      const out: Record<string, LocalAttachment> = {};
      for (const [k, v] of Object.entries(prev)) {
        if (visible.has(k)) out[k] = v;
        else URL.revokeObjectURL(v.previewUrl);
      }
      return out;
    });
  }

  function setAttachment(fieldId: string, file: File | null) {
    setAttachments((prev) => {
      const next = { ...prev };
      if (prev[fieldId]) URL.revokeObjectURL(prev[fieldId].previewUrl);
      if (file) {
        next[fieldId] = {
          file,
          previewUrl: URL.createObjectURL(file),
        };
      } else {
        delete next[fieldId];
      }
      return next;
    });
  }

  // ── Submit ───────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // Client-side required check honoring branching.
    for (const f of visibleFields) {
      if (!f.required) continue;
      if (f.type === "HEADING") continue;
      if (f.type === "ATTACHMENT") {
        if (!attachments[f.id]) {
          toast.error(`"${f.label}" is required`);
          return;
        }
        continue;
      }
      const v = answers[f.id];
      const empty =
        v == null ||
        (typeof v === "string" && v.trim() === "") ||
        (Array.isArray(v) && v.length === 0);
      if (empty) {
        toast.error(`"${f.label}" is required`);
        return;
      }
    }

    setSubmitting(true);
    try {
      // If any attachments are pending, send multipart; otherwise
      // plain JSON keeps the wire smaller.
      const hasAttachments = Object.keys(attachments).length > 0;
      let res: Response;
      if (hasAttachments) {
        const fd = new FormData();
        fd.append("answers", JSON.stringify(answers));
        for (const [fieldId, att] of Object.entries(attachments)) {
          fd.append(`attachment:${fieldId}`, att.file, att.file.name);
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
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              // Asana parity: "Add another response" — reset form.
              setAnswers({});
              setAttachments({});
              setSubmitted(false);
              setConfirmationText(null);
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

        <form
          onSubmit={handleSubmit}
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
              <div key={field.id} className="space-y-1.5">
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
                  attachment={attachments[field.id]}
                  onChange={(v) => setAnswer(field.id, v)}
                  onAttachmentChange={(file) =>
                    setAttachment(field.id, file)
                  }
                />
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
  attachment,
  onChange,
  onAttachmentChange,
}: {
  field: FormField;
  value: FormAnswerValue;
  attachment?: LocalAttachment;
  onChange: (v: FormAnswerValue) => void;
  onAttachmentChange: (file: File | null) => void;
}) {
  switch (field.type) {
    case "TEXT":
      return (
        <Input
          id={field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
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
          required={field.required}
        />
      );

    case "TEXTAREA":
      return (
        <Textarea
          id={field.id}
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
          rows={4}
          className="resize-none"
        />
      );

    case "DATE":
      return (
        <Input
          id={field.id}
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
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
          required={field.required}
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
          required={field.required}
        />
      );

    case "SELECT":
      return (
        <Select
          value={typeof value === "string" ? value : ""}
          onValueChange={onChange}
        >
          <SelectTrigger id={field.id}>
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
      const selected: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2 border rounded-md p-2.5 bg-slate-50/40">
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

    case "ATTACHMENT":
      return (
        <div>
          {attachment ? (
            <div className="flex items-center gap-2 text-sm border rounded-md px-3 py-2 bg-slate-50">
              <span className="flex-1 truncate text-slate-700">
                {attachment.file.name}
              </span>
              <span className="text-[11px] text-slate-400 tabular-nums whitespace-nowrap">
                {Math.round(attachment.file.size / 1024)} KB
              </span>
              <button
                type="button"
                onClick={() => onAttachmentChange(null)}
                className="p-1 text-slate-400 hover:text-slate-700"
                aria-label="Remove attachment"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <label
              htmlFor={field.id}
              className="flex items-center gap-2 text-sm border border-dashed rounded-md px-3 py-2 cursor-pointer hover:bg-slate-50 text-slate-600"
            >
              <Upload className="h-4 w-4 text-slate-400" />
              <span>Choose a file…</span>
              <input
                id={field.id}
                type="file"
                className="sr-only"
                accept={field.accept?.join(",")}
                onChange={(e) => {
                  const f = e.target.files?.[0] ?? null;
                  onAttachmentChange(f);
                }}
              />
            </label>
          )}
        </div>
      );

    case "HEADING":
      // Heading is rendered at the parent level — never as an input.
      return null;
  }
}
