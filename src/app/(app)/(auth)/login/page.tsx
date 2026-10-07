"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";

/* Messages the server's authorize() throws on purpose, shown verbatim. Every
   other failure (wrong password, unknown address) stays one generic line so
   the form can't be used to tell which emails have accounts. Matched by
   prefix; keep in step with src/lib/auth.ts. */
const SHOWN_LOGIN_ERRORS = ["Too many attempts", "Please verify your email"];

/* Only ever send the user to a path on THIS site. A leading "/" is not enough:
   the URL parser reads a backslash as "/" and drops tabs/newlines, so
   "/%5Cevil.example" or "/%09/evil.example" resolve to another host, and the
   router follows a cross-origin href with a full navigation — an open
   redirect right after a genuine sign-in. Rejecting those characters and then
   comparing origins closes both routes. */
function safeCallbackPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/home";
  // eslint-disable-next-line no-control-regex
  if (/[\\\u0000-\u001f\u007f]/.test(raw)) return "/home";
  if (typeof window === "undefined") return raw;
  try {
    const url = new URL(raw, window.location.origin);
    if (url.origin !== window.location.origin) return "/home";
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return "/home";
  }
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: sessionStatus } = useSession();
  const rawCallbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /* Already signed in: go where they were headed. This used to be a blanket
     server redirect in the (auth) layout, which also swallowed the password
     reset and verification pages for anyone with a session in that browser. */
  useEffect(() => {
    if (sessionStatus === "authenticated") {
      router.replace(safeCallbackPath(rawCallbackUrl));
    }
  }, [sessionStatus, rawCallbackUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        const serverMessage = result.error;
        setError(
          SHOWN_LOGIN_ERRORS.some((prefix) => serverMessage.startsWith(prefix))
            ? serverMessage
            : "Invalid email or password"
        );
      } else {
        router.push(safeCallbackPath(rawCallbackUrl));
        router.refresh();
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/ttc/img/logo-square.png" alt="TERCERO TABLADA CIVIL AND STRUCTURAL ENGINEERING INC." className="w-20 h-20 object-contain" />
        </div>
        <CardDescription className="text-center">
          Sign in to your account
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              aria-live="polite"
              className="p-3 text-sm text-red-600 bg-red-50 border border-red-100 rounded-md"
            >
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="name@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password</Label>
              <Link href="/forgot-password" className="text-xs text-muted-foreground hover:text-primary hover:underline">
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        {/* Staff-only app: accounts come from workspace invitations, so there
            is no self-service sign-up to link to. */}
        <p className="text-sm text-center text-muted-foreground w-full">
          No account yet? Ask a workspace admin to send you an invitation.
        </p>
      </CardFooter>
    </Card>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center"><div className="text-black">Loading...</div></div>}>
      <LoginForm />
    </Suspense>
  );
}
