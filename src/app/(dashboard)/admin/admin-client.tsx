"use client";

import { useState } from "react";
import {
  ShieldCheck,
  Users,
  CreditCard,
  Plug,
  AlertTriangle,
  Crown,
  Building2,
  FolderKanban,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspaceRole } from "@/lib/people-types";

/**
 * AdminClientPage — workspace admin UI shell.
 *
 * Tabs:
 *   • Overview   — workspace stats + identity
 *   • Members    — all WorkspaceMembers + their roles (replaces the
 *                  "all" view that doesn't exist elsewhere)
 *   • Billing    — plan + invoices + seats (placeholder for now)
 *   • Integrations — Resend / Vercel Blob / Anthropic keys status
 *   • Danger     — destructive actions (transfer ownership, delete)
 *
 * For this initial drop the Overview tab is fully wired; the others
 * render "Coming soon" cards. Each gets fleshed out in its own
 * follow-up commit.
 */

type AdminTab = "overview" | "members" | "billing" | "integrations" | "danger";

interface Props {
  workspace: {
    id: string;
    name: string;
    ownerId: string;
    createdAt: string;
    memberCount: number;
    projectCount: number;
  };
  callerRole: WorkspaceRole;
  callerUserId: string;
}

const TABS: { id: AdminTab; label: string; icon: typeof ShieldCheck }[] = [
  { id: "overview", label: "Overview", icon: ShieldCheck },
  { id: "members", label: "Members", icon: Users },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "integrations", label: "Integrations", icon: Plug },
  { id: "danger", label: "Danger zone", icon: AlertTriangle },
];

export function AdminClientPage({
  workspace,
  callerRole,
  callerUserId,
}: Props) {
  const [tab, setTab] = useState<AdminTab>("overview");
  const isOwner = workspace.ownerId === callerUserId;

  return (
    <div className="flex-1 flex flex-col bg-white min-h-screen">
      {/* Header */}
      <div className="border-b px-6 md:px-8 py-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#c9a84c]/15 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-[#a8893a]" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900 tracking-[-0.01em]">
              Workspace admin
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              {workspace.name}
              <span className="text-slate-400">
                {" · "}
                {isOwner ? "Owner" : "Admin"}
              </span>
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b px-6 md:px-8">
        <div className="flex items-center gap-1 overflow-x-auto">
          {TABS.map((t) => {
            const Icon = t.icon;
            const isActive = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-medium border-b-2 transition-colors whitespace-nowrap",
                  isActive
                    ? "border-[#c9a84c] text-[#a8893a]"
                    : "border-transparent text-slate-600 hover:text-slate-900"
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto px-6 md:px-8 py-6">
          {tab === "overview" && (
            <OverviewTab workspace={workspace} callerRole={callerRole} />
          )}
          {tab === "members" && <ComingSoon label="All workspace members" />}
          {tab === "billing" && <ComingSoon label="Billing & plan" />}
          {tab === "integrations" && <IntegrationsTab />}
          {tab === "danger" && (
            <DangerZoneTab isOwner={isOwner} />
          )}
        </div>
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────────────
// Overview
// ──────────────────────────────────────────────────────────────

function OverviewTab({
  workspace,
  callerRole,
}: {
  workspace: Props["workspace"];
  callerRole: WorkspaceRole;
}) {
  const created = new Date(workspace.createdAt);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          icon={Users}
          label="Members"
          value={workspace.memberCount.toString()}
        />
        <StatCard
          icon={FolderKanban}
          label="Projects"
          value={workspace.projectCount.toString()}
        />
        <StatCard
          icon={Calendar}
          label="Created"
          value={created.toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        />
      </div>

      <div className="rounded-lg border bg-slate-50 px-5 py-4">
        <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2">
          <Building2 className="w-4 h-4 text-slate-400" />
          Workspace identity
        </h3>
        <dl className="text-xs space-y-1.5">
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Name</dt>
            <dd className="text-slate-900 font-medium">{workspace.name}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Workspace ID</dt>
            <dd className="text-slate-900 font-mono text-[11px]">
              {workspace.id}
            </dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-slate-500">Your role</dt>
            <dd className="text-slate-900 font-medium inline-flex items-center gap-1">
              {callerRole === "OWNER" && (
                <Crown className="w-3 h-3 text-[#c9a84c]" />
              )}
              {callerRole}
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-lg border-l-4 border-l-[#c9a84c] bg-[#fffbea] px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-[#a8893a] font-semibold mb-1">
          About this page
        </p>
        <p className="text-sm text-slate-700 leading-relaxed">
          Workspace admin is for firm-wide settings (billing, all members,
          integrations). For personal preferences (your profile, password,
          notifications), use <span className="font-medium">Settings</span>{" "}
          from your avatar menu.
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-lg border bg-white px-4 py-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div>
        <p className="text-[11px] text-slate-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-base font-semibold text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div className="border-2 border-dashed border-slate-200 rounded-xl py-14 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 mx-auto flex items-center justify-center mb-3">
        <ShieldCheck className="w-5 h-5 text-slate-400" />
      </div>
      <h3 className="text-sm font-semibold text-slate-900 mb-1">{label}</h3>
      <p className="text-xs text-slate-500">Coming in a follow-up phase.</p>
    </div>
  );
}

function IntegrationsTab() {
  // Stub — shows which env-driven integrations are configured by
  // checking server-injected hints. For now just a static list.
  const integrations = [
    {
      name: "Resend",
      desc: "Transactional email (invitations, password reset)",
      configured: true,
    },
    {
      name: "Vercel Blob",
      desc: "File attachments + uploads",
      configured: true,
    },
    {
      name: "Anthropic",
      desc: "AI assist features",
      configured: true,
    },
    {
      name: "Neon Postgres",
      desc: "Database",
      configured: true,
    },
  ];
  return (
    <div className="space-y-2">
      {integrations.map((i) => (
        <div
          key={i.name}
          className="rounded-lg border bg-white px-4 py-3 flex items-center gap-3"
        >
          <div
            className={cn(
              "w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0",
              i.configured ? "bg-emerald-50" : "bg-rose-50"
            )}
          >
            <Plug
              className={cn(
                "w-4 h-4",
                i.configured ? "text-emerald-600" : "text-rose-500"
              )}
            />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-900">{i.name}</p>
            <p className="text-xs text-slate-500">{i.desc}</p>
          </div>
          <span
            className={cn(
              "text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full",
              i.configured
                ? "bg-emerald-50 text-emerald-700"
                : "bg-rose-50 text-rose-700"
            )}
          >
            {i.configured ? "Connected" : "Not configured"}
          </span>
        </div>
      ))}
    </div>
  );
}

function DangerZoneTab({ isOwner }: { isOwner: boolean }) {
  return (
    <div className="space-y-4">
      <DangerRow
        title="Transfer ownership"
        desc="Pass workspace ownership to another member. The new owner gets full control; you become an ADMIN."
        cta="Transfer"
        disabled={!isOwner}
        disabledReason="Only the current owner can transfer ownership."
      />
      <DangerRow
        title="Delete workspace"
        desc="Permanently delete this workspace and ALL of its data (projects, tasks, files, messages, members). Cannot be undone."
        cta="Delete workspace"
        destructive
        disabled={!isOwner}
        disabledReason="Only the current owner can delete the workspace."
      />
    </div>
  );
}

function DangerRow({
  title,
  desc,
  cta,
  destructive,
  disabled,
  disabledReason,
}: {
  title: string;
  desc: string;
  cta: string;
  destructive?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  return (
    <div className="rounded-lg border border-rose-100 bg-white px-5 py-4 flex items-start justify-between gap-4">
      <div className="flex-1 min-w-0">
        <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
        <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{desc}</p>
        {disabled && disabledReason && (
          <p className="text-[11px] text-rose-600 mt-1">{disabledReason}</p>
        )}
      </div>
      <button
        type="button"
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        className={cn(
          "px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex-shrink-0",
          disabled
            ? "bg-slate-100 text-slate-400 cursor-not-allowed"
            : destructive
              ? "bg-rose-600 text-white hover:bg-rose-700"
              : "bg-slate-900 text-white hover:bg-slate-800"
        )}
      >
        {cta}
      </button>
    </div>
  );
}
