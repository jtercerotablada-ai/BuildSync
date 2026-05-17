/**
 * Form quick-start templates — pre-baked field configurations for the
 * 6 most common engineering / construction intake use cases.
 *
 * Each template seeds the form builder with sensible name,
 * description, and field list (with proper `mapTo` + `required` +
 * `showWhen` branching) so the user goes from "blank canvas" to
 * "publish-ready" in one click.
 *
 * Categories:
 *   - RFI Request          (architect / contractor question)
 *   - Change Order         (scope change request)
 *   - Inspection Request   (site / structural inspection ask)
 *   - Recertification Intake (40-year / milestone inspection lead)
 *   - Submittal            (contractor shop drawings / product data)
 *   - General Intake       (catch-all blank template)
 */

import type { FormField } from "./form-types";

export interface FormTemplate {
  id: string;
  name: string;
  description: string;
  /** Short blurb shown on the template card in the builder. */
  blurb: string;
  /** Lucide icon name (resolved client-side). */
  icon: string;
  /** Soft pastel accent for the card background. */
  accent: "amber" | "blue" | "violet" | "rose" | "emerald" | "slate";
  /** Default confirmation message shown to the submitter. */
  confirmationMessage: string;
  fields: FormField[];
}

let _idCounter = 0;
function id(label: string): string {
  _idCounter += 1;
  return `f_${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .slice(0, 20)}_${_idCounter}`;
}

export const FORM_TEMPLATES: FormTemplate[] = [
  // ── RFI ─────────────────────────────────────────────────────
  {
    id: "rfi",
    name: "RFI · Request for Information",
    description:
      "Use this form to submit a Request for Information. Be specific about the drawing / detail in question — the design team responds within the SLA documented in the project's contract.",
    blurb:
      "Architect / contractor questions about drawings, specs, or site conditions.",
    icon: "HelpCircle",
    accent: "amber",
    confirmationMessage:
      "Your RFI has been received. The engineering team will respond per the contract SLA. You'll get an email when a response is posted.",
    fields: (() => {
      const subjectId = id("subject");
      const drawingId = id("drawing");
      const detailId = id("detail");
      const urgencyId = id("urgency");
      const impactStartedId = id("impact_started");
      const proposedFix = id("proposed_fix");
      return [
        {
          id: id("contact_name"),
          label: "Your name",
          type: "TEXT",
          required: true,
        },
        {
          id: id("contact_email"),
          label: "Your email",
          type: "EMAIL",
          required: true,
          helpText: "We'll send you the response and a receipt here.",
        },
        {
          id: id("company"),
          label: "Company / trade",
          type: "TEXT",
          required: false,
          placeholder: "e.g. ABC Construction · Steel",
        },
        {
          id: subjectId,
          label: "RFI subject",
          type: "TEXT",
          required: true,
          mapTo: "name",
          placeholder: "Clash between beam B-12 and HVAC duct",
        },
        {
          id: drawingId,
          label: "Drawing reference",
          type: "TEXT",
          required: true,
          placeholder: "e.g. S-201",
        },
        {
          id: detailId,
          label: "Detail / grid reference",
          type: "TEXT",
          required: false,
          placeholder: "e.g. detail 4/S-501 or grid C-3",
        },
        {
          id: id("description"),
          label: "Describe the question",
          type: "TEXTAREA",
          required: true,
          mapTo: "description",
          placeholder:
            "What's unclear, what's the impact, what's needed to proceed?",
        },
        {
          id: urgencyId,
          label: "Urgency",
          type: "SELECT",
          required: true,
          options: ["Routine (within 7 days)", "Priority (within 48 hours)", "Critical (work stopped)"],
        },
        {
          id: impactStartedId,
          label: "Has work been stopped?",
          type: "SELECT",
          required: true,
          options: ["No", "Yes"],
          showWhen: { fieldId: urgencyId, equals: "Critical (work stopped)" },
        },
        {
          id: proposedFix,
          label: "Proposed approach (optional)",
          type: "TEXTAREA",
          required: false,
          placeholder: "Suggest a fix if you have one — speeds the response.",
        },
        {
          id: id("response_due"),
          label: "Response needed by",
          type: "DATE",
          required: false,
          mapTo: "dueDate",
        },
        {
          id: id("attachment"),
          label: "Markup / photo (optional)",
          type: "ATTACHMENT",
          required: false,
          accept: ["image/*", "application/pdf"],
        },
      ];
    })(),
  },

  // ── Change Order ────────────────────────────────────────────
  {
    id: "change-order",
    name: "Change Order Request",
    description:
      "Use this form to request a change to the project's scope, cost, or schedule. The owner reviews and either approves, rejects, or asks for more detail.",
    blurb:
      "Scope / cost / schedule change requests with cost + schedule impact.",
    icon: "FilePenLine",
    accent: "emerald",
    confirmationMessage:
      "Change order request received. The owner will review and reach back within the contract SLA. You'll get an email with the decision.",
    fields: (() => {
      const typeId = id("co_type");
      return [
        { id: id("requester_name"), label: "Your name", type: "TEXT", required: true },
        { id: id("requester_email"), label: "Your email", type: "EMAIL", required: true },
        {
          id: id("co_title"),
          label: "Change order title",
          type: "TEXT",
          required: true,
          mapTo: "name",
          placeholder: "Add 2 additional grade beams along grid line 4",
        },
        {
          id: typeId,
          label: "Type of change",
          type: "SELECT",
          required: true,
          options: [
            "Owner-requested",
            "Field condition",
            "Design clarification",
            "Code requirement",
            "Value engineering",
          ],
        },
        {
          id: id("scope"),
          label: "Describe the change",
          type: "TEXTAREA",
          required: true,
          mapTo: "description",
        },
        {
          id: id("cost_impact"),
          label: "Estimated cost impact",
          type: "NUMBER",
          required: false,
          unit: "USD",
        },
        {
          id: id("schedule_impact"),
          label: "Schedule impact",
          type: "NUMBER",
          required: false,
          unit: "days",
        },
        {
          id: id("supporting_docs"),
          label: "Supporting documents",
          type: "ATTACHMENT",
          required: false,
          accept: ["application/pdf", "image/*"],
        },
        {
          id: id("required_by"),
          label: "Decision needed by",
          type: "DATE",
          required: true,
          mapTo: "dueDate",
        },
      ];
    })(),
  },

  // ── Inspection Request ──────────────────────────────────────
  {
    id: "inspection",
    name: "Inspection Request",
    description:
      "Use this form to request a structural / civil / MEP inspection at a project site. We coordinate access and dispatch within the requested window.",
    blurb: "Site / structural / MEP inspections with discipline routing.",
    icon: "ShieldCheck",
    accent: "blue",
    confirmationMessage:
      "Inspection request received. The team will confirm a window within 1 business day. You'll get an email with the inspector's name and ETA.",
    fields: (() => {
      const disciplineId = id("discipline");
      return [
        { id: id("requester_name"), label: "Your name", type: "TEXT", required: true },
        { id: id("requester_email"), label: "Your email", type: "EMAIL", required: true },
        { id: id("requester_phone"), label: "Phone (for site coordination)", type: "TEXT", required: true },
        {
          id: id("address"),
          label: "Site address",
          type: "TEXT",
          required: true,
          mapTo: "name",
          placeholder: "1500 Brickell Ave, Miami FL 33129",
        },
        {
          id: disciplineId,
          label: "Inspection discipline",
          type: "MULTI_SELECT",
          required: true,
          options: ["Structural", "Foundations", "MEP", "Envelope", "Roof", "ADA / Egress"],
        },
        {
          id: id("scope"),
          label: "Scope / what to inspect",
          type: "TEXTAREA",
          required: true,
          mapTo: "description",
          placeholder: "Specific elements, levels, units, etc.",
        },
        {
          id: id("preferred_window"),
          label: "Preferred inspection date",
          type: "DATE",
          required: true,
          mapTo: "dueDate",
        },
        {
          id: id("access_notes"),
          label: "Access / safety notes",
          type: "TEXTAREA",
          required: false,
          placeholder: "Gate code, lift required, PPE specifics, escort contact…",
        },
        {
          id: id("attachments"),
          label: "Plans or photos",
          type: "ATTACHMENT",
          required: false,
          accept: ["application/pdf", "image/*"],
        },
      ];
    })(),
  },

  // ── Recertification Intake ──────────────────────────────────
  {
    id: "recertification",
    name: "Building Recertification Intake",
    description:
      "Property managers and owners use this form to start a building recertification project (Florida 40-year, milestone inspection, or 10-year cycle).",
    blurb:
      "Owner / property mgmt starts a 40-year or milestone recertification.",
    icon: "BadgeCheck",
    accent: "violet",
    confirmationMessage:
      "Recertification request received. A project lead will reach out within 1 business day to confirm scope, fee, and schedule the kickoff site visit.",
    fields: [
      { id: id("contact_name"), label: "Your name", type: "TEXT", required: true },
      { id: id("contact_email"), label: "Your email", type: "EMAIL", required: true },
      { id: id("contact_phone"), label: "Phone", type: "TEXT", required: true },
      { id: id("owner_company"), label: "Owner / property management company", type: "TEXT", required: true },
      {
        id: id("building_address"),
        label: "Building address",
        type: "TEXT",
        required: true,
        mapTo: "name",
        placeholder: "1500 Brickell Ave, Miami FL 33129",
      },
      {
        id: id("year_built"),
        label: "Year built (per CO)",
        type: "NUMBER",
        required: true,
      },
      {
        id: id("floors"),
        label: "Number of floors",
        type: "NUMBER",
        required: true,
      },
      {
        id: id("inspection_type"),
        label: "Inspection type",
        type: "SELECT",
        required: true,
        options: [
          "40-year recertification (Miami-Dade)",
          "40-year recertification (Broward)",
          "Milestone Inspection (SB 4-D, 25-year coastal)",
          "Milestone Inspection (SB 4-D, 30-year inland)",
          "10-year recurring",
          "Not sure — need guidance",
        ],
      },
      {
        id: id("disciplines"),
        label: "Disciplines needed",
        type: "MULTI_SELECT",
        required: true,
        options: [
          "Structural",
          "Electrical",
          "Thermography (IR)",
          "Illumination survey",
          "Parking lot + guardrail",
        ],
      },
      {
        id: id("ahj_deadline"),
        label: "AHJ filing deadline",
        type: "DATE",
        required: false,
        mapTo: "dueDate",
      },
      {
        id: id("prior_reports"),
        label: "Prior recertification reports",
        type: "ATTACHMENT",
        required: false,
        accept: ["application/pdf"],
      },
      {
        id: id("notes"),
        label: "Anything else we should know",
        type: "TEXTAREA",
        required: false,
        mapTo: "description",
      },
    ],
  },

  // ── Submittal ───────────────────────────────────────────────
  {
    id: "submittal",
    name: "Submittal",
    description:
      "Use this form to submit shop drawings, product data, samples, or mock-ups for engineering review.",
    blurb: "Shop drawings, product data, samples for review/return.",
    icon: "Inbox",
    accent: "slate",
    confirmationMessage:
      "Submittal received and logged. The reviewer will respond within the contract turnaround (usually 14 calendar days). You'll receive the stamped return via email.",
    fields: [
      { id: id("contractor_name"), label: "Your name", type: "TEXT", required: true },
      { id: id("contractor_email"), label: "Your email", type: "EMAIL", required: true },
      { id: id("contractor_company"), label: "Company", type: "TEXT", required: true },
      {
        id: id("submittal_number"),
        label: "Submittal number",
        type: "TEXT",
        required: true,
        mapTo: "name",
        placeholder: "e.g. 03 30 00-001",
      },
      {
        id: id("submittal_type"),
        label: "Submittal type",
        type: "SELECT",
        required: true,
        options: [
          "Shop drawing",
          "Product data",
          "Sample",
          "Mock-up",
          "Test report",
          "Closeout document",
        ],
      },
      {
        id: id("spec_section"),
        label: "Spec section reference",
        type: "TEXT",
        required: true,
        placeholder: "e.g. 03 30 00",
      },
      {
        id: id("description"),
        label: "Description",
        type: "TEXTAREA",
        required: true,
        mapTo: "description",
      },
      {
        id: id("priority"),
        label: "Priority",
        type: "SELECT",
        required: false,
        options: ["Standard (14 days)", "Expedited (7 days, fee may apply)"],
      },
      {
        id: id("file"),
        label: "Submittal file",
        type: "ATTACHMENT",
        required: true,
        accept: ["application/pdf"],
      },
    ],
  },

  // ── Blank / General ─────────────────────────────────────────
  {
    id: "blank",
    name: "Blank form",
    description: "",
    blurb: "Start from scratch with a single text field.",
    icon: "FileText",
    accent: "slate",
    confirmationMessage: "",
    fields: [
      {
        id: id("description"),
        label: "Brief description",
        type: "TEXT",
        required: true,
        mapTo: "name",
        placeholder: "What's this about?",
      },
    ],
  },
];

export function findFormTemplate(id: string): FormTemplate | undefined {
  return FORM_TEMPLATES.find((t) => t.id === id);
}
