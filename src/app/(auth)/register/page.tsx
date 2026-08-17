"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader } from "@/components/ui/card";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong");
        return;
      }

      /* Do NOT jump to /onboarding. That page needs the email-verify token,
         which only exists inside the message we just sent — pushing the user
         there directly is what made every signup dead-end. The link in the
         email is the way in. */
      setSent(true);
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
          {sent ? "Check your email" : "Enter your email to get started"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sent ? (
          /* Deliberately says "if that address can be registered" rather than
             confirming we created anything — the API returns the same body for
             a new and an existing address, and this screen must not undo that. */
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              If <span className="font-medium text-foreground">{email}</span> can be
              registered, we&apos;ve sent it a link to finish setting up the account.
            </p>
            <p>
              Open that link to choose your name and password. It expires in one hour.
            </p>
            <p>Nothing arrived? Check the spam folder, then try again.</p>
            <Button variant="outline" className="w-full" onClick={() => setSent(false)}>
              Use a different email
            </Button>
          </div>
        ) : (
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
            {loading ? "Checking..." : "Continue"}
          </Button>
        </form>
        )}
      </CardContent>
      <CardFooter>
        <p className="text-sm text-center text-muted-foreground w-full">
          Already have an account?{" "}
          <Link href="/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </CardFooter>
    </Card>
  );
}
