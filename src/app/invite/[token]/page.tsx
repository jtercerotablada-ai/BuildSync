"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { signIn, useSession } from "next-auth/react";
import {
  Loader2,
  CheckCircle2,
  AlertCircle,
  Lock,
  LogIn,
  UserPlus,
  Mail,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  WORKSPACE_ROLE_META,
  POSITION_META,
  type WorkspaceRole,
  type Position,
} from "@/lib/people-types";

/**
 * /invite/[token] — public invitation landing page.
 *
 * Resolves the token via GET /api/invite/:token and renders one
 * of four states:
 *   - error (bad / expired / accepted / declined token)
 *   - signed-in + matching email → "Accept" CTA
 *   - signed-in + mismatch → sign out instructions
 *   - signed-out + existing account → "Sign in to accept"
 *   - signed-out + new email → create-account form (name + password)
 *
 * The accept POST handles all the branching; this page just picks
 * the right input affordance and redirects on success.
 */

interface Invitation {
  id: string;
  email: string;
  role: WorkspaceRole;
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED";
  expiresAt: string;
  personalMessage: string | null;
  position: Position | null;
  customTitle: string | null;
  department: string | null;
  projectId: string | null;
  companyId: string | null;
  projectRole: string | null;
  projectName: string | null;
  workspace: { id: string; name: string };
  inviter: {
    id: string;
    name: string | null;
    email: string | null;
    image: string | null;
  };
}

interface ResolveResponse {
  ok: true;
  invitation: Invitation;
  viewer: {
    signedIn: boolean;
    emailMatches: boolean;
    email: string | null;
  };
  hasAccount: boolean;
}

interface ResolveErrorResponse {
  error: string;
  code?: "accepted" | "declined" | "expired";
}

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const { data: session, status: sessionStatus } = useSession();
  const token = params?.token;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ResolveResponse | null>(null);
  const [resolveError, setResolveError] = useState<ResolveErrorResponse | null>(
    null
  );

  const [accepting, setAccepting] = useState(false);
  const [signUpName, setSignUpName] = useState("");
  const [signUpPassword, setSignUpPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Resolve the token. Re-runs whenever the next-auth session
  // state changes so the viewer block (signed in / matches) reflects
  // reality.
  const resolve = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setResolveError(null);
    try {
      const res = await fetch(`/api/invite/${token}`);
      const body = await res.json();
      if (!res.ok) {
        setResolveError(body as ResolveErrorResponse);
        return;
      }
      setData(body as ResolveResponse);
    } catch {
      setResolveError({ error: "Couldn't load this invitation" });
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (sessionStatus === "loading") return;
    resolve();
  }, [resolve, sessionStatus]);

  // ─── Loading ────────────────────────────────────────────
  if (loading || sessionStatus === "loading") {
    return (
      <PageShell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
        </div>
      </PageShell>
    );
  }

  // ─── Resolve error (expired / accepted / declined) ──────
  if (resolveError) {
    return (
      <PageShell>
        <div className="text-center py-8">
          <div className="w-14 h-14 rounded-full bg-rose-50 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-rose-500" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-1">
            {resolveError.code === "accepted"
              ? "Already accepted"
              : resolveError.code === "expired"
                ? "Invitation expired"
                : "Can't use this invitation"}
          </h1>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mb-6">
            {resolveError.code === "accepted"
              ? "This invitation was already accepted. Sign in to your workspace to continue."
              : resolveError.code === "expired"
                ? "Ask the person who sent it to send a fresh invitation."
                : resolveError.error}
          </p>
          {resolveError.code === "accepted" ? (
            <Button onClick={() => router.push("/login")}>Sign in</Button>
          ) : (
            <Button variant="outline" onClick={() => router.push("/login")}>
              Go to BuildSync
            </Button>
          )}
        </div>
      </PageShell>
    );
  }

  if (!data) return null;

  const { invitation, viewer, hasAccount } = data;
  const inviterName =
    invitation.inviter.name || invitation.inviter.email || "Someone";
  const positionLabel = invitation.position
    ? invitation.position === "OTHER"
      ? invitation.customTitle || "Other"
      : POSITION_META[invitation.position]?.label
    : null;
  const expiresInDays = Math.max(
    0,
    Math.ceil(
      (new Date(invitation.expiresAt).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  );

  // Action variants
  const accept = async (extra: { password?: string; name?: string } = {}) => {
    setAccepting(true);
    try {
      const res = await fetch(`/api/invite/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(extra),
      });
      const body = await res.json();
      if (!res.ok) {
        if (body.code === "email-mismatch") {
          toast.error(body.error);
        } else if (body.code === "needs-login") {
          const callback =
            typeof window !== "undefined"
              ? window.location.pathname
              : `/invite/${token}`;
          router.push(`/login?callbackUrl=${encodeURIComponent(callback)}`);
          return;
        } else if (body.code === "needs-password") {
          toast.error("Choose a password to create your account.");
        } else {
          toast.error(body.error || "Couldn't accept the invitation");
        }
        return;
      }
      // If the server just created the user (Path C2), sign them in
      // now so the redirect lands them inside the app authenticated.
      if (body.isNewUser && extra.password && body.email) {
        const result = await signIn("credentials", {
          email: body.email,
          password: extra.password,
          redirect: false,
        });
        if (result?.error) {
          toast.error(
            "Account created, but auto sign-in failed. Please log in manually."
          );
          router.push("/login");
          return;
        }
      }
      toast.success("Welcome to the workspace");
      router.push(body.redirect || "/home");
    } catch {
      toast.error("Unexpected error accepting invitation");
    } finally {
      setAccepting(false);
    }
  };

  // ─── Path picker ────────────────────────────────────────
  let pathBody: React.ReactNode;

  if (viewer.signedIn && !viewer.emailMatches) {
    // Path B — mismatch
    pathBody = (
      <div className="space-y-4">
        <div className="p-4 rounded-lg border bg-amber-50 border-amber-200 text-sm text-amber-900">
          <p className="font-medium mb-1">Sign out to continue</p>
          <p className="text-xs leading-relaxed">
            You're currently signed in as{" "}
            <span className="font-mono">{viewer.email}</span>, but this
            invitation is for{" "}
            <span className="font-mono">{invitation.email}</span>. Sign out
            and sign back in with the correct email to accept.
          </p>
        </div>
        <Button
          variant="outline"
          className="w-full"
          onClick={() => {
            // next-auth sign-out then back here.
            if (typeof window !== "undefined") {
              window.location.href = `/api/auth/signout?callbackUrl=${encodeURIComponent(
                `/invite/${token}`
              )}`;
            }
          }}
        >
          Sign out
        </Button>
      </div>
    );
  } else if (viewer.signedIn && viewer.emailMatches) {
    // Path A — same email, just accept
    pathBody = (
      <Button
        className="w-full bg-black hover:bg-gray-900 text-white"
        onClick={() => accept()}
        disabled={accepting}
      >
        {accepting ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Joining…
          </>
        ) : (
          <>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Accept &amp; continue
          </>
        )}
      </Button>
    );
  } else if (hasAccount) {
    // Path C1 — sign in first
    pathBody = (
      <Button
        className="w-full bg-black hover:bg-gray-900 text-white"
        onClick={() =>
          router.push(
            `/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`
          )
        }
      >
        <LogIn className="w-4 h-4 mr-2" />
        Sign in to {invitation.email}
      </Button>
    );
  } else {
    // Path C2 — brand-new user, inline sign-up
    pathBody = (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!signUpPassword) {
            toast.error("Choose a password");
            return;
          }
          accept({ password: signUpPassword, name: signUpName });
        }}
        className="space-y-3"
      >
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700">
            Full name
          </label>
          <input
            value={signUpName}
            onChange={(e) => setSignUpName(e.target.value)}
            placeholder="e.g. Daniela Ramos"
            maxLength={120}
            required
            className="w-full px-3 py-2 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-slate-700 flex items-center justify-between">
            <span>Password</span>
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="text-[11px] text-slate-500 hover:text-slate-700"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type={showPassword ? "text" : "password"}
              value={signUpPassword}
              onChange={(e) => setSignUpPassword(e.target.value)}
              placeholder="At least 8 characters"
              minLength={8}
              required
              className="w-full pl-9 pr-3 py-2 text-sm border rounded-md outline-none focus:border-[#c9a84c]"
            />
          </div>
          <p className="text-[11px] text-slate-400">
            We'll create your account with{" "}
            <span className="font-mono">{invitation.email}</span>.
          </p>
        </div>
        <Button
          type="submit"
          className="w-full bg-black hover:bg-gray-900 text-white"
          disabled={accepting}
        >
          {accepting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              <UserPlus className="w-4 h-4 mr-2" />
              Create account &amp; join
            </>
          )}
        </Button>
      </form>
    );
  }

  // ─── Render ──────────────────────────────────────────────
  return (
    <PageShell>
      <div className="space-y-5">
        {/* Inviter chip */}
        <div className="flex items-center gap-2.5">
          <Avatar className="h-9 w-9">
            <AvatarImage src={invitation.inviter.image || ""} />
            <AvatarFallback className="text-xs bg-[#d4b65a] text-white">
              {(inviterName).charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-xs text-slate-500 leading-tight">
              {inviterName} invites you to join
            </p>
            <p className="text-sm font-semibold text-slate-900 truncate flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-[#a8893a]" />
              {invitation.workspace.name}
            </p>
          </div>
        </div>

        {/* Summary card */}
        <div className="rounded-lg border bg-slate-50 px-4 py-3 space-y-2">
          <SummaryRow
            label="Email"
            value={invitation.email}
            icon={<Mail className="w-3.5 h-3.5 text-slate-400" />}
          />
          <SummaryRow
            label="Workspace role"
            value={
              WORKSPACE_ROLE_META[invitation.role]?.label || invitation.role
            }
          />
          {positionLabel && (
            <SummaryRow label="Position" value={positionLabel} />
          )}
          {invitation.department && (
            <SummaryRow label="Department" value={invitation.department} />
          )}
          {invitation.projectName && (
            <SummaryRow
              label="Starting project"
              value={invitation.projectName}
              accent
            />
          )}
        </div>

        {/* Personal note */}
        {invitation.personalMessage && (
          <div className="rounded-lg border-l-4 border-l-[#c9a84c] bg-[#fffbea] px-4 py-3">
            <p className="text-[10px] uppercase tracking-wider text-[#a8893a] font-semibold mb-1">
              Note from {inviterName}
            </p>
            <p className="text-sm text-slate-800 whitespace-pre-wrap leading-relaxed">
              {invitation.personalMessage}
            </p>
          </div>
        )}

        {/* Action */}
        <div>{pathBody}</div>

        <p className="text-[11px] text-slate-400 text-center">
          Expires in {expiresInDays} {expiresInDays === 1 ? "day" : "days"}
        </p>
      </div>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg border overflow-hidden">
        <div className="bg-black px-6 py-5 text-center">
          <h2 className="text-white text-base font-semibold">BuildSync</h2>
          <p className="text-[11px] text-slate-300 mt-0.5">
            Workspace invitation
          </p>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}

function SummaryRow({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-xs">
      <span className="text-slate-500 flex items-center gap-1.5">
        {icon}
        {label}
      </span>
      <span
        className={
          accent
            ? "text-[#a8893a] font-semibold truncate"
            : "text-slate-900 font-medium truncate"
        }
      >
        {value}
      </span>
    </div>
  );
}
