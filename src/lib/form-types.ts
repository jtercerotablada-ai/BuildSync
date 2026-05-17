/**
 * Form types — shared between API, builder UI, public render, and
 * submission → task conversion.
 *
 * A Form belongs to a project. It has N FormFields, each with a type
 * and optional mapTo. When the form is submitted, its answers create
 * a FormSubmission AND a Task in the project (so the user's intake
 * flow becomes the team's backlog automatically).
 *
 * Branching: each field can optionally declare `showWhen` — a
 * dependency on another SELECT field's value. The runtime hides
 * fields whose dependency isn't satisfied, and the server stores
 * only the answers that were actually visible at submit time.
 */

export type FormFieldType =
  | "TEXT"         // single-line input
  | "TEXTAREA"     // multi-line input
  | "EMAIL"        // single-line, type=email
  | "DATE"         // date picker
  | "NUMBER"       // numeric input with optional unit
  | "SELECT"       // single-choice dropdown
  | "MULTI_SELECT" // multiple-choice checkboxes
  | "PEOPLE"       // submitter types a name; recorded as plain text
                   //   (PUBLIC forms can't authoritatively pick users)
  | "ATTACHMENT"   // file upload (single file per field)
  | "HEADING";     // visual section separator (no answer collected)

/**
 * Where this field's answer ends up on the auto-created Task.
 *   - "name"        → Task.name (required exactly once per form;
 *                     falls back to "New submission to {form}" if
 *                     unset)
 *   - "description" → Task.description (concatenated if multiple)
 *   - "dueDate"     → Task.dueDate (DATE field only)
 *   - undefined     → stays in FormSubmission.data only; appended to
 *                     the task description as "Label: Answer" for
 *                     audit / reference.
 */
export type FormFieldMapTo = "name" | "description" | "dueDate";

/**
 * Conditional visibility rule. A field with `showWhen` is hidden
 * unless the referenced SELECT field's current value matches.
 *
 *   showWhen: { fieldId: "f-request-type", equals: "RFI" }
 *
 * For MULTI_SELECT fields, `equals` matches when the listed value is
 * one of the checked options. `equals` can be an array to express
 * "any of these values".
 */
export interface FormFieldShowWhen {
  fieldId: string;
  equals: string | string[];
}

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** Required when type === "SELECT" or "MULTI_SELECT". */
  options?: string[];
  /** NUMBER fields can carry a unit (kg, m², $, etc.) shown to the
   *  submitter and stored alongside the value. */
  unit?: string;
  /** ATTACHMENT fields can restrict accepted MIME types
   *  (e.g. ["image/*", "application/pdf"]). */
  accept?: string[];
  /** Maps this answer onto the auto-created Task. */
  mapTo?: FormFieldMapTo;
  /** Conditional visibility — see FormFieldShowWhen. */
  showWhen?: FormFieldShowWhen;
}

export interface FormRow {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  isActive: boolean;
  projectId: string;
  // ── Settings (DB-backed) ────────────────────────────────────
  defaultSectionId: string | null;
  defaultAssigneeId: string | null;
  confirmationMessage: string | null;
  notifyOnSubmission: boolean;
  visibility: "PUBLIC" | "ORGANIZATION";
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
}

/**
 * Public-facing shape (no auth needed). Used by the form-render page.
 * Strips fields the public should never see.
 */
export interface PublicFormRow {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  isActive: boolean;
  projectId: string;
  confirmationMessage: string | null;
  visibility: "PUBLIC" | "ORGANIZATION";
}

/**
 * Submission answer values:
 *   - string          for TEXT / EMAIL / DATE / NUMBER / SELECT / PEOPLE / TEXTAREA
 *   - string[]        for MULTI_SELECT
 *   - attachment[]    for ATTACHMENT (always an array; one file = [obj])
 *   - null            when cleared / never answered
 *
 * The single-object attachment shape is kept in the union as a
 * "legacy" branch so submissions made before multi-file support
 * (when ATTACHMENT was one file per field) still parse cleanly.
 * Reader helpers (formatAnswerForText) flatten both shapes into a
 * comma list.
 */
export interface FormAttachment {
  name: string;
  url: string;
  size: number;
  mimeType: string;
}

export type FormAnswerValue =
  | string
  | string[]
  | FormAttachment
  | FormAttachment[]
  | null;

export type FormSubmissionPayload = Record<string, FormAnswerValue>;

// ─────────────────────────────────────────────────────────────────
// Branching evaluation
// ─────────────────────────────────────────────────────────────────

/**
 * Returns true when this field should be visible given the current
 * answers. Fields without a `showWhen` rule are always visible.
 *
 * A field whose dependency points at another SELECT/MULTI_SELECT
 * field becomes visible only when that field's current value
 * matches the rule. Cross-references to non-SELECT fields are
 * intentionally treated as "always show" (the rule is malformed —
 * default to safe).
 */
export function isFieldVisible(
  field: FormField,
  answers: FormSubmissionPayload,
  fieldsById: Map<string, FormField>
): boolean {
  if (!field.showWhen) return true;
  const dep = fieldsById.get(field.showWhen.fieldId);
  if (!dep) return true; // dangling reference → show
  if (dep.type !== "SELECT" && dep.type !== "MULTI_SELECT") return true;

  const currentValue = answers[field.showWhen.fieldId];
  const equalsList = Array.isArray(field.showWhen.equals)
    ? field.showWhen.equals
    : [field.showWhen.equals];

  if (dep.type === "MULTI_SELECT") {
    if (!Array.isArray(currentValue)) return false;
    // MULTI_SELECT only ever holds string[]; the union with
    // FormAttachment[] is for ATTACHMENT, which never controls
    // branching. Cast to narrow for `.includes`.
    const stringValues = currentValue as string[];
    return equalsList.some((v) => stringValues.includes(v));
  }
  // SELECT
  if (typeof currentValue !== "string") return false;
  return equalsList.includes(currentValue);
}

/**
 * Strip non-visible field answers from a payload (used at submit time
 * so we never persist values for fields the user couldn't see).
 */
export function pruneHiddenAnswers(
  fields: FormField[],
  answers: FormSubmissionPayload
): FormSubmissionPayload {
  const byId = new Map(fields.map((f) => [f.id, f] as const));
  const pruned: FormSubmissionPayload = {};
  for (const f of fields) {
    if (f.type === "HEADING") continue; // never carries an answer
    if (!isFieldVisible(f, answers, byId)) continue;
    if (answers[f.id] !== undefined) pruned[f.id] = answers[f.id];
  }
  return pruned;
}

// ─────────────────────────────────────────────────────────────────
// Submission → Task mapping
// ─────────────────────────────────────────────────────────────────

/**
 * Render a single answer value as a string for display / description
 * concatenation. ATTACHMENT becomes "filename1 (url1), filename2 (url2)".
 * MULTI_SELECT becomes "a, b, c". null/undefined → empty string.
 */
function isAttachment(v: unknown): v is FormAttachment {
  return (
    typeof v === "object" &&
    v !== null &&
    "url" in v &&
    "name" in v &&
    "size" in v
  );
}

export function formatAnswerForText(value: FormAnswerValue): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    // Array could be MULTI_SELECT strings OR attachment[].
    return value
      .map((v) =>
        isAttachment(v) ? `${v.name} (${v.url})` : String(v)
      )
      .join(", ");
  }
  // Single attachment (legacy single-file shape).
  if (isAttachment(value)) return `${value.name} (${value.url})`;
  return String(value);
}

/**
 * Convert form answers into Task fields. Used by the submit endpoint
 * so the public form page → task pipeline is deterministic.
 */
export function buildTaskFromSubmission(
  form: { fields: FormField[]; name: string },
  answers: FormSubmissionPayload
): { name: string; description: string; dueDate: string | null } {
  let taskName = "";
  const descriptionParts: string[] = [];
  let dueDate: string | null = null;

  for (const field of form.fields) {
    if (field.type === "HEADING") continue;
    const raw = answers[field.id];
    if (raw == null || raw === "" || (Array.isArray(raw) && raw.length === 0)) {
      continue;
    }

    if (field.mapTo === "name") {
      // First name-mapped field wins; subsequent ones append.
      const stringValue = formatAnswerForText(raw);
      if (!taskName) taskName = stringValue;
      else descriptionParts.push(`${field.label}: ${stringValue}`);
    } else if (field.mapTo === "description") {
      descriptionParts.push(formatAnswerForText(raw));
    } else if (field.mapTo === "dueDate" && field.type === "DATE") {
      // The DATE field gives us yyyy-MM-dd; convert to local-noon
      // ISO to avoid the timezone-shift bug we hit in the calendar.
      const parts = String(raw).split("-").map(Number);
      if (parts.length === 3) {
        const noon = new Date(
          parts[0],
          (parts[1] ?? 1) - 1,
          parts[2] ?? 1,
          12,
          0,
          0
        );
        dueDate = noon.toISOString();
      }
    } else {
      // Unmapped field — append to description as a labeled line so
      // the task reader can see the raw answers.
      descriptionParts.push(`${field.label}: ${formatAnswerForText(raw)}`);
    }
  }

  // Fall back to the form's name when no field is mapTo: "name".
  if (!taskName) taskName = `New submission to ${form.name}`;

  return {
    name: taskName.slice(0, 200), // sane upper bound
    description: descriptionParts.join("\n\n"),
    dueDate,
  };
}
