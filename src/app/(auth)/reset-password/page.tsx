"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { CheckCircle, Eye, EyeOff, Loader2 } from "lucide-react";

function getPasswordStrength(password: string): number {
  let score = 0;
  if (password.length >= 8) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColors = ["", "bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-green-500"];

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const strength = getPasswordStrength(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to reset password");
      }

      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white font-semibold text-base">
              <span>B<span className="text-sm">s</span><span className="text-[10px] ml-[1px]">.</span></span>
            </div>
            <span className="text-2xl font-bold">BuildSync</span>
          </div>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-muted-foreground">Invalid reset link. Please request a new one.</p>
        </CardContent>
        <CardFooter>
          <Button variant="outline" asChild className="w-full">
            <Link href="/forgot-password">Request new link</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (success) {
    return (
      <Card>
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white font-semibold text-base">
              <span>B<span className="text-sm">s</span><span className="text-[10px] ml-[1px]">.</span></span>
            </div>
            <span className="text-2xl font-bold">BuildSync</span>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4 py-8">
          <CheckCircle className="h-12 w-12 text-green-600" />
          <div className="text-center">
            <p className="font-semibold text-lg">Password reset!</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your password has been changed. You can now sign in.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button asChild className="w-full">
            <Link href="/login">Sign in</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-black text-white font-semibold text-base">
            <span>B<span className="text-sm">s</span><span className="text-[10px] ml-[1px]">.</span></span>
          </div>
          <span className="text-2xl font-bold">BuildSync</span>
        </div>
        <CardDescription className="text-center">
          Set a new password for your account
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-black bg-white border border-black rounded-md">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="password">New password</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Min. 8 characters"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        i <= strength ? strengthColors[strength] : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">{strengthLabels[strength]}</p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat password"
                required
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => setShowConfirm(!showConfirm)}
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Resetting..." : "Reset password"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center text-muted-foreground w-full">
          <Link href="/login" className="text-primary hover:underline">
            Back to login
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
