"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { FormField } from "@/lib/form-types";

/**
 * Public form submission page. Anyone with the URL can fill it.
 *
 * This page is intentionally outside (dashboard) / (public) layouts
 * so it renders standalone — no app chrome, no marketing chrome,
 * just the form. Submitters often arrive via email link and the
 * cleaner the page, the higher the completion rate.
 *
 * On submit we POST to /api/forms/:formId/submit; the API creates
 * the FormSubmission AND a Task in the form's project (via mapTo).
 */

interface PublicForm {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  isActive: boolean;
}

export default function PublicFormPage() {
  const params = useParams<{ formId: string }>();
  const formId = params?.formId;

  const [form, setForm] = useState<PublicForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // ── Fetch form schema ─────────────────────────────────────
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
        const data: PublicForm = await res.json();
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

  // ── Submit ───────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form) return;

    // Client-side required check first so we don't even round-trip
    // on obvious misses. Server validates again for safety.
    for (const f of form.fields) {
      if (f.required && !answers[f.id]?.trim()) {
        toast.error(`"${f.label}" is required`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/forms/${form.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error || "Submission failed");
      }
      setSubmitted(true);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Submission failed"
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render states ────────────────────────────────────────

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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
        <div className="max-w-md w-full bg-white rounded-lg border shadow-sm p-8 text-center">
          <div className="w-12 h-12 rounded-full bg-[#c9a84c]/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="h-6 w-6 text-[#a8893a]" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">
            Submission received
          </h1>
          <p className="text-sm text-slate-500">
            Thanks — the project team has been notified and your
            submission has been added to their backlog.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-2xl mx-auto">
        <header className="text-center mb-6">
          <h1 className="text-2xl font-semibold text-slate-900">{form.name}</h1>
          {form.description && (
            <p className="mt-2 text-sm text-slate-600 whitespace-pre-wrap">
              {form.description}
            </p>
          )}
        </header>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-lg border shadow-sm p-6 space-y-5"
        >
          {form.fields.map((field) => (
            <div key={field.id} className="space-y-1.5">
              <label
                htmlFor={field.id}
                className="text-sm font-medium text-slate-700 flex items-center gap-1"
              >
                {field.label}
                {field.required && (
                  <span className="text-[#a8893a]" aria-label="required">
                    *
                  </span>
                )}
              </label>
              {field.helpText && (
                <p className="text-[11px] text-slate-500">{field.helpText}</p>
              )}
              <FieldInput
                field={field}
                value={answers[field.id] || ""}
                onChange={(v) =>
                  setAnswers((prev) => ({ ...prev, [field.id]: v }))
                }
              />
            </div>
          ))}

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

        <p className="text-[11px] text-slate-400 text-center mt-4">
          Powered by Tercero Tablada
        </p>
      </div>
    </div>
  );
}

// ─── Field renderer ──────────────────────────────────────────────

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FormField;
  value: string;
  onChange: (v: string) => void;
}) {
  switch (field.type) {
    case "TEXT":
      return (
        <Input
          id={field.id}
          value={value}
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          required={field.required}
        />
      );
    case "TEXTAREA":
      return (
        <Textarea
          id={field.id}
          value={value}
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
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );
    case "SELECT":
      return (
        <Select value={value} onValueChange={onChange}>
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
  }
}
