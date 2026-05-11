/**
 * Engineering OKR templates — opinionated for structural / civil firms.
 *
 * Each template seeds an Objective + a set of KeyResults that fit a
 * Construction / Design / Recertification / Permit operation. Used by
 * the "New goal" dropdown in /goals to give users a one-click start
 * instead of a blank canvas.
 *
 * Format matches the Prisma KeyResultFormat enum:
 *   NUMBER | PERCENTAGE | CURRENCY | BOOLEAN
 */

export type GoalTemplateCategory =
  | "REVENUE"
  | "DELIVERY"
  | "COMPLIANCE"
  | "QUALITY"
  | "GROWTH";

export interface GoalTemplate {
  id: string;
  name: string;
  description: string;
  category: GoalTemplateCategory;
  /** Lucide icon name (rendered dynamically by consumer). */
  icon: string;
  objective: {
    name: string;
    description: string;
    progressSource: "KEY_RESULTS" | "PROJECTS";
  };
  keyResults: {
    name: string;
    description?: string;
    targetValue: number;
    startValue: number;
    unit: string;
    format: "NUMBER" | "PERCENTAGE" | "CURRENCY" | "BOOLEAN";
  }[];
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
  {
    id: "revenue-by-project-type",
    name: "Revenue by project type",
    description:
      "Hit revenue targets across all four service lines — construction, design, recertification, permitting.",
    category: "REVENUE",
    icon: "DollarSign",
    objective: {
      name: "Hit FY revenue mix across all project types",
      description:
        "Balanced revenue across construction supervision, design, recertification, and permitting to de-risk against any one market cycle.",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "Construction revenue",
        targetValue: 1_500_000,
        startValue: 0,
        unit: "USD",
        format: "CURRENCY",
      },
      {
        name: "Design revenue",
        targetValue: 900_000,
        startValue: 0,
        unit: "USD",
        format: "CURRENCY",
      },
      {
        name: "Recertification revenue",
        targetValue: 400_000,
        startValue: 0,
        unit: "USD",
        format: "CURRENCY",
      },
      {
        name: "Permitting revenue",
        targetValue: 200_000,
        startValue: 0,
        unit: "USD",
        format: "CURRENCY",
      },
    ],
  },
  {
    id: "on-time-pe-signatures",
    name: "On-time P.E. signatures",
    description:
      "Drive faster, more predictable structural seal turnaround on every deliverable.",
    category: "DELIVERY",
    icon: "Stamp",
    objective: {
      name: "Reduce P.E. seal turnaround and miss zero deadlines",
      description:
        "Every sealed drawing leaves on the date promised. Tracks both throughput (turnaround) and reliability (% on time).",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "% sealed deliverables shipped on or before promised date",
        targetValue: 100,
        startValue: 0,
        unit: "%",
        format: "PERCENTAGE",
      },
      {
        name: "Average seal turnaround (target: 3 business days)",
        targetValue: 3,
        startValue: 10,
        unit: "days",
        format: "NUMBER",
      },
    ],
  },
  {
    id: "zero-permit-deadline-misses",
    name: "Zero permit-deadline misses",
    description:
      "Track permit-filing reliability and rejection rate across DOB / municipal authorities.",
    category: "COMPLIANCE",
    icon: "FileCheck",
    objective: {
      name: "Zero missed permit-application deadlines",
      description:
        "Every permit application filed on or before the legal/contractual deadline; rejections caught and resubmitted within one cycle.",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "# permits filed on or before deadline",
        targetValue: 24,
        startValue: 0,
        unit: "count",
        format: "NUMBER",
      },
      {
        name: "# permit rejections requiring rework",
        description:
          "Lower is better — start value reflects last year baseline; aim to drive to zero.",
        targetValue: 0,
        startValue: 6,
        unit: "count",
        format: "NUMBER",
      },
    ],
  },
  {
    id: "fisp-cycle-9-compliance",
    name: "FISP Cycle 9 compliance",
    description:
      "Façade Inspection & Safety Program — NYC Local Law 11. Track filings due, filed, accepted.",
    category: "COMPLIANCE",
    icon: "ShieldCheck",
    objective: {
      name: "100% on-time FISP Cycle 9 filings accepted by DOB",
      description:
        "Every façade recert assignment filed before its DOB sub-cycle deadline and accepted on first review.",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "# filings due this cycle",
        targetValue: 12,
        startValue: 12,
        unit: "count",
        format: "NUMBER",
      },
      {
        name: "# filings submitted on time",
        targetValue: 12,
        startValue: 0,
        unit: "count",
        format: "NUMBER",
      },
      {
        name: "# filings accepted by DOB on first review",
        targetValue: 12,
        startValue: 0,
        unit: "count",
        format: "NUMBER",
      },
    ],
  },
  {
    id: "design-revision-rate",
    name: "Design revision rate",
    description:
      "Drive down revisions per CD set and increase first-pass approval rate from architects/clients.",
    category: "QUALITY",
    icon: "Ruler",
    objective: {
      name: "Cut design revisions per CD set in half",
      description:
        "Higher first-pass approval = less rework, faster billing, happier clients. Tracks both inputs (revisions) and outcomes (approval rate).",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "Average revisions per CD set",
        description:
          "Lower is better. Baseline is current trailing-12 average.",
        targetValue: 2,
        startValue: 5,
        unit: "revisions",
        format: "NUMBER",
      },
      {
        name: "% of CD sets approved on first submission",
        targetValue: 75,
        startValue: 40,
        unit: "%",
        format: "PERCENTAGE",
      },
    ],
  },
  {
    id: "utilization-target",
    name: "Utilization target",
    description:
      "Hit billable-hour utilization targets for licensed P.E.s and EITs.",
    category: "GROWTH",
    icon: "Activity",
    objective: {
      name: "Sustain healthy billable utilization across the team",
      description:
        "Industry norms: P.E.s ~70%, EITs ~80% billable. Tracks both roles separately so over/under-staffing surfaces fast.",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "% billable hours — P.E. roles",
        targetValue: 70,
        startValue: 50,
        unit: "%",
        format: "PERCENTAGE",
      },
      {
        name: "% billable hours — EIT roles",
        targetValue: 80,
        startValue: 60,
        unit: "%",
        format: "PERCENTAGE",
      },
    ],
  },
  {
    id: "client-nps",
    name: "Client NPS",
    description:
      "Measure client satisfaction via post-project survey, NPS score, and referral count.",
    category: "QUALITY",
    icon: "Smile",
    objective: {
      name: "Drive client NPS to 60+ and earn 6+ referrals",
      description:
        "Quality leading indicator (NPS) plus a hard outcome (referrals received). Sustained 60+ NPS in pro services is excellent.",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "# post-project NPS surveys sent",
        targetValue: 20,
        startValue: 0,
        unit: "count",
        format: "NUMBER",
      },
      {
        name: "Average NPS score (target: 60+)",
        targetValue: 60,
        startValue: 30,
        unit: "score",
        format: "NUMBER",
      },
      {
        name: "# referrals received from existing clients",
        targetValue: 6,
        startValue: 0,
        unit: "count",
        format: "NUMBER",
      },
    ],
  },
  {
    id: "pipeline-health",
    name: "Pipeline health",
    description:
      "Track active proposals, total pipeline value, and proposal win-rate.",
    category: "GROWTH",
    icon: "TrendingUp",
    objective: {
      name: "Build a $5M+ qualified pipeline with 40%+ win rate",
      description:
        "Forward-looking revenue indicator. Tracks pipeline volume and conversion quality together.",
      progressSource: "KEY_RESULTS",
    },
    keyResults: [
      {
        name: "# active proposals",
        targetValue: 25,
        startValue: 0,
        unit: "count",
        format: "NUMBER",
      },
      {
        name: "Total qualified pipeline value",
        targetValue: 5_000_000,
        startValue: 0,
        unit: "USD",
        format: "CURRENCY",
      },
      {
        name: "Proposal win rate",
        targetValue: 40,
        startValue: 20,
        unit: "%",
        format: "PERCENTAGE",
      },
    ],
  },
];

export const GOAL_TEMPLATE_CATEGORY_LABEL: Record<
  GoalTemplateCategory,
  string
> = {
  REVENUE: "Revenue",
  DELIVERY: "Delivery",
  COMPLIANCE: "Compliance",
  QUALITY: "Quality",
  GROWTH: "Growth",
};

export function findGoalTemplate(id: string): GoalTemplate | undefined {
  return GOAL_TEMPLATES.find((t) => t.id === id);
}
