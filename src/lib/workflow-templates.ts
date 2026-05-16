/**
 * Engineering-specific workflow templates.
 *
 * Each template is a bundle of rules tailored to a real handoff that
 * recurs across civil/structural projects. When the user applies a
 * template:
 *   1. We ensure every section referenced by the template exists in
 *      the project (creating any that don't).
 *   2. We create one workflow rule per template rule, wiring the
 *      trigger to the right section id.
 *
 * Actions are kept generic so the engine can run them without extra
 * config — typically ADD_COMMENT (a guidance message for the team)
 * + MARK_COMPLETE / SET_PRIORITY / ADD_SUBTASK. SET_ASSIGNEE is
 * skipped here because it needs a user picker; the user can edit
 * the rule post-apply.
 */

import type { WorkflowAction } from "@/lib/workflow-types";

export type TemplateTriggerSpec =
  | { type: "TASK_MOVED_TO_SECTION"; sectionName: string }
  | { type: "TASK_COMPLETED" };

export interface TemplateRuleSpec {
  trigger: TemplateTriggerSpec;
  actions: WorkflowAction[];
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  /** Lucide icon name — resolved in the UI */
  icon: string;
  /** Section names this template uses. We create any that don't
   *  already exist on the project. Order is the order they'll be
   *  added in. */
  sections: string[];
  rules: TemplateRuleSpec[];
}

/**
 * Standard engineering handoff library. Every template is opt-in —
 * applying one only creates its rules + missing sections; it never
 * deletes existing ones. So multiple templates can be layered.
 */
export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  // ── Structural deliverables lifecycle ──────────────────────────
  {
    id: "calc-package-review",
    name: "Calc package review",
    description:
      "Standard handoff for moving structural calculation packages from draft to stamped & sealed.",
    icon: "ClipboardCheck",
    sections: ["Drafting", "Ready for Review", "Stamping", "Issued"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Ready for Review" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Calc package ready for PE review. Verify load paths, code citations, and unit consistency before stamping.",
          },
          { type: "SET_PRIORITY", priority: "MEDIUM" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Stamping" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Approved — apply PE stamp & seal, then move to Issued.",
          },
          { type: "ADD_SUBTASK", name: "Apply stamp & seal" },
          { type: "ADD_SUBTASK", name: "Archive signed PDF to project folder" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Issued" },
        actions: [
          {
            type: "ADD_COMMENT",
            content: "Issued to client. Log issuance date and revision.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Permitting cycle ───────────────────────────────────────────
  {
    id: "permit-cycle",
    name: "Permit submittal cycle",
    description:
      "Tracks tasks through permit prep, AHJ review, corrections, and approval.",
    icon: "FileBadge",
    sections: ["Permit Prep", "Submitted to AHJ", "Corrections", "Approved"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Submitted to AHJ" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Submitted to AHJ. Expect first comments within 2-4 weeks. Log submittal number and reviewer.",
          },
          { type: "SET_PRIORITY", priority: "MEDIUM" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Corrections" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "AHJ corrections received. Track every comment, prepare response narrative, re-submit revised drawings.",
          },
          { type: "SET_PRIORITY", priority: "HIGH" },
          { type: "ADD_SUBTASK", name: "Draft response narrative" },
          { type: "ADD_SUBTASK", name: "Revise affected sheets" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Approved" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Permit approved — log permit #, expiration date, and any conditions of approval.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Submittal review ───────────────────────────────────────────
  {
    id: "submittal-review",
    name: "Contractor submittal review",
    description:
      "Standard turnaround for contractor submittals (shop drawings, product data, samples).",
    icon: "Inbox",
    sections: ["Received", "Under Review", "Returned"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Received" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Log submittal number, spec section, and date received. Review must close within contract turnaround window.",
          },
          { type: "SET_PRIORITY", priority: "MEDIUM" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Under Review" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Verify conformance with spec, drawings, and applicable codes. Stamp action: APPROVED / APPROVED AS NOTED / REVISE & RESUBMIT / REJECTED.",
          },
          { type: "ADD_SUBTASK", name: "Spec conformance check" },
          { type: "ADD_SUBTASK", name: "Code/standards check" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Returned" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Returned to contractor with stamp action. Update submittal log.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── RFI lifecycle ──────────────────────────────────────────────
  {
    id: "rfi-lifecycle",
    name: "RFI lifecycle (field questions)",
    description:
      "Open Requests for Information, track turnaround, close with documented response.",
    icon: "HelpCircle",
    sections: ["RFI Open", "RFI Response Drafted", "RFI Closed"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "RFI Open" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "RFI logged. Confirm RFI #, originator, and field impact. Standard turnaround: 5 business days.",
          },
          { type: "SET_PRIORITY", priority: "HIGH" },
        ],
      },
      {
        trigger: {
          type: "TASK_MOVED_TO_SECTION",
          sectionName: "RFI Response Drafted",
        },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Response drafted. PE review before sending — verify code references and detail clarity.",
          },
          { type: "ADD_SUBTASK", name: "PE review of response" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "RFI Closed" },
        actions: [
          {
            type: "ADD_COMMENT",
            content: "RFI closed and response transmitted. Archive in RFI log.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Change order ───────────────────────────────────────────────
  {
    id: "change-order",
    name: "Change order processing",
    description:
      "Tracks construction change orders from request through pricing, approval, and execution.",
    icon: "FilePenLine",
    sections: ["CO Requested", "Pricing", "Pending Owner", "Executed"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "CO Requested" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Change order requested. Capture scope, schedule impact, and cost driver. Notify PM and owner rep.",
          },
          { type: "SET_PRIORITY", priority: "HIGH" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Pricing" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Cost & schedule analysis underway. Attach pricing breakdown before moving to Pending Owner.",
          },
          { type: "ADD_SUBTASK", name: "Cost breakdown" },
          { type: "ADD_SUBTASK", name: "Schedule impact analysis" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Pending Owner" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Awaiting owner sign-off. Log expected decision date.",
          },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Executed" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "CO executed. Update contract value, log CO number, distribute to field team.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Inspection ────────────────────────────────────────────────
  {
    id: "inspection-cycle",
    name: "Special inspection cycle",
    description:
      "Schedule, perform, and close out special inspections required by code.",
    icon: "Search",
    sections: ["Scheduled", "Performed", "Report Issued"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Scheduled" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Inspection scheduled. Confirm 24h notice to contractor and inspector availability.",
          },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Performed" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Inspection performed. Document observations, deficiencies, and corrective actions.",
          },
          { type: "ADD_SUBTASK", name: "Photo documentation" },
          { type: "ADD_SUBTASK", name: "Deficiency list" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Report Issued" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Inspection report issued to project team and AHJ as required.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Bid / proposal ────────────────────────────────────────────
  {
    id: "bid-proposal",
    name: "Bid & proposal pipeline",
    description:
      "Track new business from RFP through proposal submission and award.",
    icon: "Briefcase",
    sections: ["Lead", "Proposal Drafting", "Submitted", "Won", "Lost"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Proposal Drafting" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Proposal in drafting — outline scope, fee structure, and assumptions. Confirm go/no-go before submittal.",
          },
          { type: "ADD_SUBTASK", name: "Scope outline" },
          { type: "ADD_SUBTASK", name: "Fee proposal" },
          { type: "ADD_SUBTASK", name: "Assumptions & exclusions" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Submitted" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Proposal submitted. Log submittal date and follow-up cadence.",
          },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Won" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Won! Kick off project setup: contract, project number, kickoff meeting.",
          },
          { type: "ADD_SUBTASK", name: "Execute contract" },
          { type: "ADD_SUBTASK", name: "Set up project folder" },
          { type: "ADD_SUBTASK", name: "Schedule kickoff" },
        ],
      },
    ],
  },

  // ── Closeout ──────────────────────────────────────────────────
  {
    id: "project-closeout",
    name: "Project closeout",
    description:
      "Final deliverables, archival, and post-project review handoff.",
    icon: "PackageCheck",
    sections: ["Final Deliverables", "Archived", "Lessons Learned"],
    rules: [
      {
        trigger: {
          type: "TASK_MOVED_TO_SECTION",
          sectionName: "Final Deliverables",
        },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Closeout package: as-builts, stamped final set, calc package archive, certifications.",
          },
          { type: "ADD_SUBTASK", name: "As-built drawings" },
          { type: "ADD_SUBTASK", name: "Final calc archive" },
          { type: "ADD_SUBTASK", name: "Certifications & affidavits" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Archived" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Project archived. Confirm record retention policy and folder structure.",
          },
        ],
      },
      {
        trigger: {
          type: "TASK_MOVED_TO_SECTION",
          sectionName: "Lessons Learned",
        },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Lessons-learned session — capture what went well, what to change next time, and any reusable details.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Recertification ───────────────────────────────────────────
  {
    id: "recertification",
    name: "License & recertification tracker",
    description:
      "Reminders + checklist for PE license renewals and continuing-education hours.",
    icon: "BadgeCheck",
    sections: ["Upcoming", "In Progress", "Renewed"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Upcoming" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Renewal window opens. Verify CEU/PDH hours, ethics credits, and state-specific requirements.",
          },
          { type: "ADD_SUBTASK", name: "Verify CEU/PDH hours" },
          { type: "ADD_SUBTASK", name: "Ethics credits check" },
          { type: "ADD_SUBTASK", name: "State filing" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "Renewed" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "License renewed — record new expiration date and store certificate.",
          },
          { type: "MARK_COMPLETE" },
        ],
      },
    ],
  },

  // ── Quality control gate ──────────────────────────────────────
  {
    id: "qc-gate",
    name: "Internal QC gate",
    description:
      "Three-step QC checkpoint before any deliverable leaves the office.",
    icon: "ShieldCheck",
    sections: ["QC Review", "QC Comments", "QC Cleared"],
    rules: [
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "QC Review" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "Internal QC review — verify completeness, code conformance, drawing/calc consistency, and client requirements.",
          },
          { type: "ADD_SUBTASK", name: "Completeness check" },
          { type: "ADD_SUBTASK", name: "Code conformance" },
          { type: "ADD_SUBTASK", name: "Drawing/calc consistency" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "QC Comments" },
        actions: [
          {
            type: "ADD_COMMENT",
            content:
              "QC comments issued. Address every comment with status (Resolved / Accepted / Deferred) before re-submitting.",
          },
          { type: "SET_PRIORITY", priority: "HIGH" },
        ],
      },
      {
        trigger: { type: "TASK_MOVED_TO_SECTION", sectionName: "QC Cleared" },
        actions: [
          {
            type: "ADD_COMMENT",
            content: "QC cleared — okay to issue.",
          },
        ],
      },
    ],
  },
];

export function findTemplateById(id: string): WorkflowTemplate | undefined {
  return WORKFLOW_TEMPLATES.find((t) => t.id === id);
}
