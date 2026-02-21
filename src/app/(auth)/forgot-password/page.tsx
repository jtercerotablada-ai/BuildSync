"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Something went wrong");
      }

      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
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
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
            <Mail className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="text-center">
            <p className="font-semibold text-lg">Check your email</p>
            <p className="text-sm text-muted-foreground mt-1">
              If an account exists for <span className="font-medium">{email}</span>,
              we&apos;ve sent a password reset link.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button variant="outline" asChild className="w-full">
            <Link href="/login">Back to login</Link>
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
          Enter your email and we&apos;ll send you a reset link
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

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Sending..." : "Send reset link"}
          </Button>
        </form>
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center text-muted-foreground w-full">
          Remember your password?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
