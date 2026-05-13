/**
 * Form types — shared between API, builder UI, public render, and
 * submission → task conversion.
 *
 * A Form belongs to a project. It has N FormFields, each with a type
 * and optional mapTo. When the form is submitted, its answers create
 * a FormSubmission AND a Task in the project (so the user's intake
 * flow becomes the team's backlog automatically).
 */

export type FormFieldType =
  | "TEXT"        // single-line input
  | "TEXTAREA"    // multi-line input
  | "EMAIL"       // single-line, type=email
  | "DATE"        // date picker
  | "SELECT";     // dropdown with options[]

/**
 * Where this field's answer ends up on the auto-created Task.
 * - "name"        → Task.name (required exactly once per form)
 * - "description" → Task.description (concatenated if multiple)
 * - "dueDate"     → Task.dueDate (DATE field only)
 * - undefined     → stays in FormSubmission.data only; appended to
 *                   the task description as "Field: Answer" for
 *                   audit / reference.
 */
export type FormFieldMapTo = "name" | "description" | "dueDate";

export interface FormField {
  id: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  /** Required when type === "SELECT" */
  options?: string[];
  /** Maps this answer onto the auto-created Task. */
  mapTo?: FormFieldMapTo;
}

export interface FormRow {
  id: string;
  name: string;
  description: string | null;
  fields: FormField[];
  isActive: boolean;
  projectId: string;
  createdAt: string;
  updatedAt: string;
  submissionCount?: number;
}

/**
 * The user's answer payload sent from the public form page.
 * { [fieldId]: answerValue }
 */
export type FormSubmissionPayload = Record<string, string>;

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
    const raw = answers[field.id];
    if (raw == null || raw === "") continue;

    if (field.mapTo === "name") {
      // First name-mapped field wins; subsequent ones append.
      if (!taskName) taskName = String(raw);
      else descriptionParts.push(`${field.label}: ${raw}`);
    } else if (field.mapTo === "description") {
      descriptionParts.push(String(raw));
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
      descriptionParts.push(`${field.label}: ${raw}`);
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
